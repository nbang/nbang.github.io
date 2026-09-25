import requests
import re
import json

def investigate():
    print("Fetching dn.aizia.info...")
    response = requests.get('https://dn.aizia.info/')
    html = response.text
    
    # Extract __next_f payloads
    print("Looking for __next_f payloads...")
    payloads = re.findall(r'self\.__next_f\.push\((.*?)\)</script>', html)
    print(f"Found {len(payloads)} payloads.")
    for p in payloads:
        if 'tra cứu' in p.lower() or 'vnm' in p.lower() or 'vinamilk' in p.lower():
            print("Found interesting payload:", p[:500])

    # Extract JS chunk URLs
    print("Looking for JS chunks...")
    chunks = re.findall(r'/_next/static/chunks/[^"]*\.js', html)
    for chunk in set(chunks):
        url = f"https://dn.aizia.info{chunk}"
        js_res = requests.get(url)
        js = js_res.text
        if 'fetch(' in js or 'axios' in js or 'https://' in js:
            urls = re.findall(r'https://[^\s"\'\`]+', js)
            api_urls = [u for u in urls if 'aizia' in u or 'api' in u or 'data' in u or 'supabase' in u or 'firebase' in u]
            if api_urls:
                print(f"In chunk {chunk}, found potential URLs:", set(api_urls))

if __name__ == '__main__':
    investigate()
