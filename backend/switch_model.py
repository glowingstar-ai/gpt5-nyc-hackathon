#!/usr/bin/env python3
"""Script to easily switch between GPT-4o and GPT-5 models."""

import sys
import re

def switch_model(model_name: str):
    """Switch the annotation model in config.py"""
    config_file = "app/core/config.py"
    
    try:
        with open(config_file, 'r') as f:
            content = f.read()
        
        # Replace the default model
        pattern = r'openai_annotation_model: str = Field\(\s*default="[^"]*"'
        replacement = f'openai_annotation_model: str = Field(\n        default="{model_name}"'
        
        new_content = re.sub(pattern, replacement, content)
        
        with open(config_file, 'w') as f:
            f.write(new_content)
        
        print(f"✅ Successfully switched to {model_name}")
        print(f"📝 Note: GPT-5 models use the Responses API automatically")
        print(f"📝 Note: Other models use the Chat Completions API")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python switch_model.py <model_name>")
        print("Example: python switch_model.py gpt-5")
        print("Example: python switch_model.py gpt-4o")
        sys.exit(1)
    
    model_name = sys.argv[1]
    switch_model(model_name)
