import json
import os


def load_json(file_path):
    """Loads a JSON file and returns its content."""
    with open(file_path, 'r', encoding='utf-8') as file:
        return json.load(file)

def find_missing_keys(json1, json2):
    """
    Finds keys present in json1 but missing in json2 and vice versa.
    Returns two sets: keys_missing_in_json2, keys_missing_in_json1.
    """
    keys_json1 = set(json1.keys())
    keys_json2 = set(json2.keys())

    # Keys present in json1 but missing in json2
    keys_missing_in_json2 = keys_json1 - keys_json2

    # Keys present in json2 but missing in json1
    keys_missing_in_json1 = keys_json2 - keys_json1

    return keys_missing_in_json2, keys_missing_in_json1

def compare_json_files(file1, file2):
    """Compares two JSON translation files and prints the missing keys."""
    json1 = load_json(file1)
    json2 = load_json(file2)

    missing_in_json2, missing_in_json1 = find_missing_keys(json1, json2)

    if missing_in_json2:
        print(f"Keys present in {file1} but missing in {file2}:")
        for key in missing_in_json2:
            print(f"  {key}")
    else:
        print(f"No missing keys in {file2} from {file1}.")

    if missing_in_json1:
        print(f"\nKeys present in {file2} but missing in {file1}:")
        for key in missing_in_json1:
            print(f"  {key}")
    else:
        print(f"No missing keys in {file1} from {file2}.")

# Example usage:
base_path = os.path.dirname(os.path.abspath(__file__))
folder_path =  base_path + '/../src/assets/i18n'  # Path to the folder containing the JSON files
source_file = folder_path + '/en.json'  # Path to the English (source) JSON file

languages = ['tw.json', 'tr.json', 'es.json', 'it.json', 'pt.json', 'de.json', 'ar.json']  # Target language files
for language in languages:
    file2 = folder_path + '/' + language
    compare_json_files(source_file, file2)
