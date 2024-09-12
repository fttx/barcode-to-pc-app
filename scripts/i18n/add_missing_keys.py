import json
import os
import json
from collections import OrderedDict

def compare_json_files(source_file, target_file, output_file):
    """
    Compare two JSON files and add missing keys from source to target in the exact same position.

    Args:
        source_file (str): Path to the source JSON file (e.g., English translation).
        target_file (str): Path to the target JSON file (e.g., translated version).
        output_file (str): Path to save the updated target file with missing keys added.
    """

    # Load source and target JSON files as OrderedDict to preserve key order
    with open(source_file, 'r', encoding='utf-8') as src_file:
        source_data = json.load(src_file, object_pairs_hook=OrderedDict)

    with open(target_file, 'r', encoding='utf-8') as tgt_file:
        target_data = json.load(tgt_file, object_pairs_hook=OrderedDict)

    def add_missing_keys_in_order(source, target):
        """
        Recursively add missing keys from source to target, while maintaining the order.
        """
        for key, value in source.items():
            if key not in target:
                # Insert the missing key at the same position in the target file
                target[key] = value
            elif isinstance(value, dict) and isinstance(target.get(key), dict):
                # If the value is a dictionary, recurse into it
                add_missing_keys_in_order(value, target[key])

    # Create an OrderedDict to store the new target data in the correct order
    updated_target = OrderedDict()

    for key in source_data:
        if key in target_data:
            # If the key exists in both, add it from target (to preserve translations)
            updated_target[key] = target_data[key]
        else:
            # If the key is missing in target, add it from the source (in the correct order)
            updated_target[key] = source_data[key]

        # If it's a dictionary, make sure to recurse into it to add any missing keys
        if isinstance(source_data[key], dict) and isinstance(updated_target[key], dict):
            add_missing_keys_in_order(source_data[key], updated_target[key])

    # Write the updated target JSON file with the correct order and two-space indentation
    with open(output_file, 'w', encoding='utf-8') as out_file:
        json.dump(updated_target, out_file, ensure_ascii=False, indent=2)

    print(f"Missing keys from {source_file} have been added to {target_file} and saved as {output_file}")

def update_translations(source_file, languages, folder_path):
    """
    Update all translation files with missing keys from the source file.

    Args:
        source_file (str): Path to the source JSON file (e.g., English translation).
        languages (list): List of target language JSON files to compare and update.
        folder_path (str): Folder path where all the JSON files are located.
    """
    for language in languages:
        target_file = os.path.join(folder_path, language)
        output_file = os.path.join(folder_path, f"{language.split('.')[0]}.json")

        compare_json_files(source_file, target_file, output_file)

base_path = os.path.dirname(os.path.abspath(__file__))
folder_path =  base_path + '/../src/assets/i18n'  # Path to the folder containing the JSON files
source_file = folder_path + '/en.json'  # Path to the English (source) JSON file
languages = ['tw.json', 'tr.json', 'es.json', 'it.json', 'pt.json', 'de.json', 'ar.json']  # Target language files

update_translations(source_file, languages, folder_path)
