#!/usr/bin/env python3
import json

# Color values provided by user (RGBA 0-255 format)
colors = {
    "pink": [
        "rgba(253, 243, 250, 1)", "rgba(251, 231, 245, 1)", "rgba(248, 207, 235, 1)",
        "rgba(244, 184, 225, 1)", "rgba(241, 160, 215, 1)", "rgba(237, 136, 205, 1)",
        "rgba(190, 109, 164, 1)", "rgba(142, 82, 123, 1)", "rgba(95, 54, 82, 1)",
        "rgba(47, 27, 41, 1)"
    ],
    "gold": [
        "rgba(253, 249, 239, 1)", "rgba(252, 242, 223, 1)", "rgba(248, 229, 191, 1)",
        "rgba(245, 217, 158, 1)", "rgba(241, 204, 126, 1)", "rgba(238, 191, 94, 1)",
        "rgba(190, 153, 75, 1)", "rgba(143, 115, 56, 1)", "rgba(95, 76, 38, 1)",
        "rgba(48, 38, 19, 1)"
    ]
}

shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

# Variable ID series for each color
id_series = {
    "pink": 600,
    "gold": 700
}

def parse_rgba(rgba_str):
    """Convert rgba(r, g, b, a) string to dict with 0-1 values"""
    parts = rgba_str.replace("rgba(", "").replace(")", "").split(",")
    return {
        "r": int(parts[0].strip()) / 255,
        "g": int(parts[1].strip()) / 255,
        "b": int(parts[2].strip()) / 255,
        "a": float(parts[3].strip())
    }

def create_base_color_variable(color_name, shade, rgba_str, series):
    """Create a base color variable JSON object"""
    rgb = parse_rgba(rgba_str)
    return {
        "id": f"VariableID:{series}:{shade}",
        "name": f"{color_name}/{shade}",
        "description": "",
        "type": "COLOR",
        "valuesByMode": {
            "1:1": rgb
        },
        "resolvedValuesByMode": {
            "1:1": {
                "resolvedValue": rgb
            }
        },
        "scopes": ["ALL_SCOPES"],
        "hiddenFromPublishing": False,
        "codeSyntax": {}
    }

# Load existing tokens
with open('00_input/color-tokens.json', 'r') as f:
    tokens = json.load(f)

# Generate new variable IDs for pink and gold
new_variable_ids = []
new_variables = []

for color_name, rgba_list in colors.items():
    series = id_series[color_name]
    for i, shade in enumerate(shades):
        var_id = f"VariableID:{series}:{shade}"
        new_variable_ids.append(var_id)
        new_variables.append(create_base_color_variable(color_name, shade, rgba_list[i], series))

# Add new variable IDs to the tokens
tokens["variableIds"].extend(new_variable_ids)

# Insert new variables at the end of the variables array
tokens["variables"].extend(new_variables)

# Write updated tokens
with open('00_input/color-tokens.json', 'w') as f:
    json.dump(tokens, f)

print("✓ Added 20 base color variables (pink, gold)")
print(f"✓ Total variables: {len(tokens['variables'])}")
print(f"✓ Total variable IDs: {len(tokens['variableIds'])}")
