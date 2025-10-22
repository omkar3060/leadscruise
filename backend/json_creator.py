from bs4 import BeautifulSoup
import json
import sys
import os

def convert_products_to_json(input_file, output_file):
    """Convert HTML product listing to JSON format"""
    try:
        # Load HTML file
        with open(input_file, "r", encoding="utf-8") as f:
            html_content = f.read()

        # Parse with BeautifulSoup
        soup = BeautifulSoup(html_content, "html.parser")

        products = []
        for product in soup.find_all("li", class_="listElement"):
            product_id = product.get("id", "").replace("productList", "")
            
            # Name
            name_tag = product.select_one(".product-name a")
            name = name_tag.get_text(strip=True) if name_tag else None

            # Price
            price_tag = product.select_one(".productPriceCheck")
            price = price_tag.get("data-price") if price_tag else None

            # Unit
            unit_tag = product.select_one(f"#unitOfProductSpan_{product_id}")
            unit = unit_tag.get_text(strip=True) if unit_tag else None

            # Image
            img_tag = product.select_one(".product-image-box img.pro")
            img_url = img_tag["src"] if img_tag else None

            # Group / Brand
            group_tag = product.select_one(".product-group span.grpidrspan")
            group = group_tag.get_text(strip=True) if group_tag else None

            # Categories
            categories = [c.get_text(strip=True) for c in product.select(".chipsL1 .chip1")]

            # Description
            desc_tag = product.select_one(".prdDescHeadCard + span")
            description = desc_tag.get_text(" ", strip=True) if desc_tag else None

            # Specifications
            specs = {}
            for spec in product.select(".specific ul li"):
                label = spec.find("label")
                value = spec.find("span")
                if label and value:
                    specs[label.get_text(strip=True)] = value.get_text(strip=True)

            products.append({
                "id": product_id,
                "name": name,
                "price": price,
                "unit": unit,
                "image": img_url,
                "group": group,
                "categories": categories,
                "description": description,
                "specifications": specs
            })

        # Save JSON
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(products, f, indent=2, ensure_ascii=False)

        print(f"✅ Conversion complete! JSON saved to {output_file}")
        print(f"✅ Total products processed: {len(products)}")
        return 0
        
    except FileNotFoundError:
        print(f"❌ Error: Input file '{input_file}' not found", flush=True)
        return 1
    except Exception as e:
        print(f"❌ Error during conversion: {str(e)}", flush=True)
        return 1


if __name__ == "__main__":
    # Get unique_id from command line arguments
    if len(sys.argv) > 1:
        unique_id = sys.argv[1]
        print(f"Processing with unique_id: {unique_id}", flush=True)
    else:
        print("❌ Error: unique_id not provided", flush=True)
        print("Usage: python json_creator.py <unique_id>", flush=True)
        sys.exit(1)
    
    # Create filenames with unique_id
    input_file = f"json_lister_{unique_id}.txt"
    output_file = f"products_{unique_id}.json"
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"❌ Error: Input file '{input_file}' not found", flush=True)
        sys.exit(1)
    
    # Convert and exit with appropriate code
    exit_code = convert_products_to_json(input_file, output_file)
    sys.exit(exit_code)