import os

def check_braces(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    for i, char in enumerate(content):
        if char == '{':
            stack.append(i)
        elif char == '}':
            if not stack:
                print(f"Excess closing brace at index {i}")
            else:
                stack.pop()
    
    if stack:
        print(f"Unclosed braces at indices: {stack}")
    else:
        print("Braces are balanced")

check_braces(r'c:\Users\ezary\OneDrive\Documents\Coding-Language\omniscient\components\workspace\world-canvas.tsx')
