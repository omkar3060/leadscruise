import sys
import json

def main():
    try:
        input_data = json.load(sys.stdin)
        sentences = input_data.get("sentences", "").split("\n")
        word_array = input_data.get("wordArray", "").split(",")
        h2_word_array = input_data.get("h2WordArray", "").split(",")
        mobile_number = input_data["mobileNumber"]
        password = input_data["password"]

        # Call your functions here with the data
        print("Data received successfully.")
        print(f"Sentences: {sentences}")
        print(f"Word Array: {word_array}")
        print(f"H2 Word Array: {h2_word_array}")
        print(f"Mobile Number: {mobile_number}")
        print(f"Password: {password}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
