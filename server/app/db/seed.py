import asyncio
import csv
import os
from pathlib import Path
from prisma import Prisma

# Initialize Prisma client
db = Prisma(auto_register=True)

CSV_FILENAME = "shopify-all-rak-products.csv"

# --- YOUR CURRENT STOCK DATA ---
CURRENT_INVENTORY = {
    # First Shipment
    "100003": 3,
    "204017": 10,
    "114032": 2,
    "100067": 3,
    "115110": 5,   
    "110052": 3,
    "100001": 3,
    "100071": 3,
    "204016": 4,   
    "100076": 3,
    "715105": 2,
    "100046": 3,
    "910115": 10,
    "305044": 100,
    "910224": 4,
    "115145": 2,
    "920122": 10,
    "114008": 10,
    "910225": 4,
    "110081": 5,
    "114014": 8,
    "114012": 8,
    "110043": 3,
    "100028": 3,
    "205024": 2,
    "110082": 20,
    "114000": 10,
    "925034": 20,
    "925009": 5,
    "200005": 2,

    # Second Shipment - Part 1
    "100038": 3,
    "110088": 3,
    "925049": 2,
    "910396": 4,
    "100002": 3,
    "100048": 3,
    "910077": 2,
    "110091": 3,
    "110033": 3,
    "110191": 3,
    "100044": 3,
    "910253": 4,
    "910232": 4,
    "920091": 20,
    "114031": 16,
    "910114": 10,
    "100040": 3,
    "100103": 3,
    "915001": 2,
    "110087": 5,
    "910235": 4,
    "920000": 3,
    "305045": 200, 
    "110016": 3,
    "920041": 3,
    "920430": 4,
    "815069": 2,
    "110004": 3,

    # Second Shipment - Part 2
    "925053": 20,
    "920460": 5,
    "915280": 5,
    "925036": 13,  
    "920462": 5,
    "910009": 3,
    "315050": 3,
    "410008": 3,
    "100099": 7,
    "315046": 6,
    "315052": 4,
    "305051": 20,
    "305053": 5,
    "305057": 10,
    "305061": 10,
    "105231": 15,
    "714073": 4,   
    "515011": 4,   
    "714031": 3,
    "715103": 3,   
    "915039": 5,
    "200012": 3,
    "B05046": 3,
    "920034": 5,
    "920423": 5,
    "925028": 2,
    "925050": 1,
    "910033": 2,
    "920084": 2,
    "920286": 1,
    "920287": 1,
    "920160": 2,
    "105010": 2,
    "610003": 2,
    "920029": 2,
    "305055": 2,

    # Third Shipment
    "105130": 2,
    "100011": 3,
    "100015": 3,
    "910116": 5,
    "100207": 3,
    "110086": 4,
    "920437": 2,
    "100105": 3,
    "214018": 5,
    "214011": 3,
    "100090": 3,
    "714086": 2,
    "100029": 3,
    "110060": 3,
    "114035": 5,
    "110111": 3,
    "910421": 3,
    "100106": 2,
    "714082": 2,
    "100102": 2,
    "114022": 2,
    "110070": 3,
    "110077": 3,
    "100019": 9,
    "920418": 2,
    "110055": 3,
    "910252": 4,
    "110035": 5
}

def fix_encoding_artifacts(text: str) -> str:
    """Fix common UTF-8 decoding artifacts found in Shopify exports."""
    replacements = {
        "¬Æ": "®",
        "Ôºå": ", ", # Weird wide comma
        "‚Äì": "-",  # En dash
        "‚Äî": "-",  # Em dash
        "‚Äô": "'",  # Smart quote
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text

def clean_title(raw_title: str) -> str:
    """
    Keep text before the 2nd pipe '|'.
    Example: "A | B | C" -> "A | B"
    """
    # [CHANGED] Apply artifact cleaning
    clean = fix_encoding_artifacts(raw_title)
    parts = [p.strip() for p in clean.split('|')]
    return " | ".join(parts[:2])

def format_product_name(row: dict) -> str:
    """
    Format: "Base Title | OptionValue1 | OptionValue2"
    """
    # 1. Base Title
    base_title = clean_title(row.get('Title', ''))
    final_name_parts = [base_title]

    # 2. Iterate through Option 1, 2, 3
    for i in range(1, 4):
        opt_name = row.get(f'Option{i} Name')
        opt_val = row.get(f'Option{i} Value')

        if opt_name and opt_val and opt_name != 'Title' and opt_val != 'Default Title':
            # [CHANGED] Clean artifacts in values too (e.g. 900MHz...)
            clean_val = fix_encoding_artifacts(opt_val)
            final_name_parts.append(clean_val)

    return " | ".join(final_name_parts)

async def update_stock_quantities(db: Prisma):
    print("\n--- 📦 Updating Stock Quantities ---")
    updated_count = 0
    not_found_count = 0

    for sku, qty in CURRENT_INVENTORY.items():
        # Find product by SKU
        product = await db.product.find_unique(where={'sku': sku})
        
        if product:
            await db.product.update(
                where={'id': product.id},
                data={'quantityInStock': qty}
            )
            updated_count += 1
        else:
            print(f"   ⚠️ SKU {sku} not found in catalog!")
            not_found_count += 1
            
    print(f"✅ Stock Update Complete: {updated_count} updated, {not_found_count} not found.")

async def main() -> None:
    print("--- 🚀 Starting Hard Reset Import ---")
    await db.connect()

    # 1. LOCATE CSV
    base_dir = Path(__file__).parent.parent.parent 
    csv_path = base_dir / CSV_FILENAME

    if not csv_path.exists():
        print(f"❌ ERROR: Could not find {CSV_FILENAME}")
        await db.disconnect()
        return

    # 2. CLEAR OLD DATA
    print("🗑️  Clearing old database entries...")
    await db.orderlineitem.delete_many()
    await db.shipmentrequest.delete_many()
    deleted_count = await db.product.delete_many()
    print(f"   Deleted {deleted_count} old products.")

    # 3. PARSE CSV
    processed_skus = set()
    products_to_create = []

    print(f"📄 Reading {csv_path}...")

    try:
        with open(csv_path, mode='r', encoding='utf-8-sig') as csvfile:
            reader = csv.DictReader(csvfile)
            
            for row in reader:
                raw_sku = row.get('SKU', '').strip()

                if not raw_sku: continue 
                if raw_sku in processed_skus: continue 
                
                processed_skus.add(raw_sku)

                full_name = format_product_name(row)

                products_to_create.append({
                    'sku': raw_sku,
                    'name': full_name,
                    'quantityInStock': 0,
                })

        print(f"📦 Found {len(products_to_create)} unique valid products.")

        # 4. INSERT NEW DATA
        if products_to_create:
            print("💾 Writing to database...")
            count = await db.product.create_many(
                data=products_to_create,
                skip_duplicates=True 
            )
            print(f"✅ Successfully seeded {count} products with 0 stock.")
            
            # 5. UPDATE STOCK
            await update_stock_quantities(db)
            
        else:
            print("⚠️ No valid products found to import.")

    except Exception as e:
        print(f"❌ Critical Error: {e}")

    await db.disconnect()
    print("--- 🌱 Process Complete ---")

if __name__ == '__main__':
    asyncio.run(main())