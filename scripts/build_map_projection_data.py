"""Build the side-car dataset for map-projection.html.

Downloads Natural Earth 110m country boundaries and, for every country,
computes two numbers:

  * true_area_km2      -- real surface area on the sphere. An equal-area
                          projection such as Equal Earth (endorsed by the UN
                          General Assembly on 2026-09-04) renders every country
                          in proportion to this value.
  * mercator_area_km2  -- the area the country *appears* to cover on a Mercator
                          map, calibrated so scale at the equator is 1:1.
                          Mercator's area scale factor is sec(lat)**2, so this
                          grows without bound towards the poles.

The ratio of the two is the "inflation factor" the page ranks countries by.

Usage:
    python3 scripts/build_map_projection_data.py
"""

import json
import math
import urllib.request
from pathlib import Path

SOURCE_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_110m_admin_0_countries.geojson"
)
OUTPUT_FILE = Path(__file__).resolve().parent.parent / "map-projection-data.json"

EARTH_RADIUS_KM = 6371.0088
# Web Mercator's conventional cut-off. Beyond it the projection runs to
# infinity, so any country reaching this latitude gets flagged rather than
# reported as a precise number.
MERCATOR_LAT_LIMIT = 85.051129
COORD_PRECISION = 2  # ~1.1 km at the equator; plenty for a world overview

# Antarctica and the like are kept so the maps look complete, but they are
# tagged so the ranking can exclude anything that is not a country.
SOVEREIGN_TYPES = {"Sovereign country", "Country"}


def fetch_source():
    print(f"Downloading {SOURCE_URL} ...")
    with urllib.request.urlopen(SOURCE_URL) as response:
        return json.loads(response.read().decode("utf-8"))


def polygons_of(geometry):
    """Yield every polygon (list of rings) in a Polygon/MultiPolygon."""
    kind = geometry.get("type")
    if kind == "Polygon":
        yield geometry["coordinates"]
    elif kind == "MultiPolygon":
        yield from geometry["coordinates"]


def ring_spherical_area_km2(ring):
    """Unsigned area of a ring on the sphere (Chamberlain-Duquette)."""
    if len(ring) < 4:
        return 0.0
    total = 0.0
    for (lon1, lat1), (lon2, lat2) in zip(ring, ring[1:]):
        # Normalise the longitude step so segments crossing the antimeridian
        # contribute their short way round rather than wrapping the globe.
        d_lon = math.radians(lon2 - lon1)
        while d_lon > math.pi:
            d_lon -= 2 * math.pi
        while d_lon < -math.pi:
            d_lon += 2 * math.pi
        total += d_lon * (2 + math.sin(math.radians(lat1)) + math.sin(math.radians(lat2)))
    return abs(total) * EARTH_RADIUS_KM**2 / 2


def ring_mercator_area_km2(ring):
    """Unsigned area of a ring in Mercator's plane, in equator-equivalent km2."""
    if len(ring) < 4:
        return 0.0
    points = []
    for lon, lat in ring:
        clamped = max(-MERCATOR_LAT_LIMIT, min(MERCATOR_LAT_LIMIT, lat))
        x = EARTH_RADIUS_KM * math.radians(lon)
        y = EARTH_RADIUS_KM * math.log(math.tan(math.pi / 4 + math.radians(clamped) / 2))
        points.append((x, y))
    total = 0.0
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        total += x1 * y2 - x2 * y1
    return abs(total) / 2


def areas_of(geometry):
    """(true_km2, mercator_km2) for a geometry, treating ring[0] as the
    exterior and any further rings as holes, per the GeoJSON spec."""
    true_area = 0.0
    mercator_area = 0.0
    for rings in polygons_of(geometry):
        for index, ring in enumerate(rings):
            sign = 1 if index == 0 else -1
            true_area += sign * ring_spherical_area_km2(ring)
            mercator_area += sign * ring_mercator_area_km2(ring)
    return true_area, mercator_area


def touches_mercator_limit(geometry):
    """True when the shape reaches latitudes where Mercator blows up."""
    for rings in polygons_of(geometry):
        for ring in rings:
            for _lon, lat in ring:
                if abs(lat) >= MERCATOR_LAT_LIMIT:
                    return True
    return False


def round_geometry(geometry):
    """Shrink the payload by rounding coordinates and dropping degenerate rings."""

    def round_ring(ring):
        out = []
        for lon, lat in ring:
            point = [round(lon, COORD_PRECISION), round(lat, COORD_PRECISION)]
            if not out or point != out[-1]:
                out.append(point)
        if len(out) >= 3 and out[0] != out[-1]:
            out.append(out[0])
        return out if len(out) >= 4 else None

    rounded = []
    for rings in polygons_of(geometry):
        kept = [r for r in (round_ring(ring) for ring in rings) if r]
        if kept:
            rounded.append(kept)
    if not rounded:
        return None
    if len(rounded) == 1:
        return {"type": "Polygon", "coordinates": rounded[0]}
    return {"type": "MultiPolygon", "coordinates": rounded}


def build():
    source = fetch_source()
    countries = []

    for feature in source["features"]:
        props = feature["properties"]
        geometry = feature.get("geometry")
        if not geometry:
            continue

        true_area, mercator_area = areas_of(geometry)
        if true_area <= 0:
            print(f"  skipping {props.get('NAME')}: no usable area")
            continue

        simplified = round_geometry(geometry)
        if simplified is None:
            print(f"  skipping {props.get('NAME')}: geometry too small to draw")
            continue

        # Antarctica runs to the pole, where Mercator runs to infinity, so no
        # single apparent-area number for it would be honest.
        off_scale = touches_mercator_limit(geometry)

        iso = props.get("ISO_A3_EH") or props.get("ADM0_A3") or props.get("NAME")
        countries.append(
            {
                "iso": iso if iso and iso != "-99" else props.get("ADM0_A3"),
                "name": props.get("NAME"),
                "name_long": props.get("NAME_LONG"),
                "continent": props.get("CONTINENT"),
                "type": props.get("TYPE"),
                "is_country": props.get("TYPE") in SOVEREIGN_TYPES,
                "region": props.get("SUBREGION"),
                "population": props.get("POP_EST"),
                "label": [props.get("LABEL_X"), props.get("LABEL_Y")],
                "true_km2": round(true_area),
                "mercator_km2": None if off_scale else round(mercator_area),
                "off_scale": off_scale,
                "geometry": simplified,
            }
        )

    countries.sort(key=lambda c: -c["true_km2"])
    payload = {
        "generated_utc": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": SOURCE_URL,
        "source_name": "Natural Earth 1:110m Admin 0 - Countries",
        "earth_radius_km": EARTH_RADIUS_KM,
        "mercator_lat_limit": MERCATOR_LAT_LIMIT,
        "notes": (
            "true_km2 is the spherical surface area, which is also the area an "
            "equal-area projection such as Equal Earth renders in proportion to. "
            "mercator_km2 is the apparent area on a Mercator map calibrated to "
            "true scale at the equator."
        ),
        "countries": countries,
    }

    OUTPUT_FILE.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    size_kb = OUTPUT_FILE.stat().st_size / 1024
    print(f"Wrote {len(countries)} countries to {OUTPUT_FILE.name} ({size_kb:.0f} KB)")

    print("\nSanity check - largest Mercator inflation:")
    ranked = sorted(
        (c for c in countries if c["mercator_km2"]),
        key=lambda c: -c["mercator_km2"] / c["true_km2"],
    )
    for c in ranked[:8]:
        factor = c["mercator_km2"] / c["true_km2"]
        print(f"  {c['name']:<24} {c['true_km2']:>12,} km2  x{factor:.2f}")


if __name__ == "__main__":
    build()
