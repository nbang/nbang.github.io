import urllib.request
import re
import json

URL = "https://raw.githubusercontent.com/ripienaar/free-for-dev/refs/heads/master/README.md"
OUTPUT_FILE = "d:\\work\\nbang.github.io\\freefordev-data.js"

def fetch_data():
    print(f"Downloading data from {URL}...")
    try:
        with urllib.request.urlopen(URL) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"Error downloading data: {e}")
        return None

def parse_markdown(md_content):
    print("Parsing Markdown data...")
    categories = []
    current_category = None
    
    # Split by lines
    lines = md_content.split('\n')
    
    # Regex for TOC (Table of Contents) - we want to skip or use it to identify sections
    # But usually parsing headers ## is better
    
    # Regex for Category Header: ### <Name>
    # Note: The README structure usually has '## Table of Contents' then '## <Category>' or '### <Category>'
    # Let's inspect the structure roughly: usually categories are secondary headers or tertiary.
    # Looking at the raw file usually:
    # ## Major Application
    # ### Sub Application
    # - [Link](url) - Desc
    
    # We will treat any header level 2 or 3 as a potential category if it contains items.
    
    category_pattern = re.compile(r'^(#{2,3})\s+(.+)$')
    # Item pattern: - [Name](Link) - Description
    # or * [Name](Link) - Description
    item_pattern = re.compile(r'^[\-\*]\s+\[(.*?)\]\((.*?)\)\s*[\-\—]\s*(.*)$')
    
    toc_started = False
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Skip Table of Contents
        if "Table of Contents" in line:
            toc_started = True
            continue
        
        # Heuristic: The actual content usually starts after the TOC. 
        # But we can just parse headers.
        
        cat_match = category_pattern.match(line)
        if cat_match:
            # New Category
            level = len(cat_match.group(1))
            name = cat_match.group(2).strip()
            
            # Skip "Table of Contents" or "Introduction" if they don't have items?
            # Let's keep them as categories for now, but usually they won't match item patterns.
            
            current_category = {
                "name": name,
                "level": level,
                "items": []
            }
            categories.append(current_category)
            continue
            
        item_match = item_pattern.match(line)
        if item_match and current_category:
            name = item_match.group(1).strip()
            link = item_match.group(2).strip()
            desc = item_match.group(3).strip()
            
            current_category["items"].append({
                "name": name,
                "link": link,
                "description": desc
            })
            
    # Filter out empty categories (like TOC headers if they got caught)
    valid_categories = [c for c in categories if len(c['items']) > 0]
    
    return valid_categories

def save_js(data):
    print(f"Saving to {OUTPUT_FILE}...")
    json_str = json.dumps(data, indent=2)
    js_content = f"// Generated data from free-for-dev README\nwindow.freeForDevData = {json_str};\n"
    
    with open(OUTPUT_FILE, "w", encoding='utf-8') as f:
        f.write(js_content)
    print("Done.")

def main():
    md_content = fetch_data()
    if md_content:
        data = parse_markdown(md_content)
        print(f"Found {len(data)} categories.")
        save_js(data)

if __name__ == "__main__":
    main()
