"""Explain the compile + time step that the course does but this machine can't.

In Ed Donner's Week 4, after the model generates C++ it is compiled and timed
against the Python to show a real speedup. That requires a C++ compiler
(g++ or clang++), which is NOT installed on this machine, so optimize.py only
generates the C++. This script prints the exact commands a reader would run
once a compiler is available.
"""

import shutil

COMPILERS = ["g++", "clang++"]


def main() -> None:
    print("=== Compile + time step (skipped here) ===\n")

    found = {name: shutil.which(name) for name in COMPILERS}
    available = {k: v for k, v in found.items() if v}

    if available:
        for name, path in available.items():
            print(f"Found {name}: {path}")
        print("\nA compiler is available, so you COULD compile and time the C++.")
    else:
        print("No C++ compiler found (checked: " + ", ".join(COMPILERS) + ").")
        print("That is why optimize.py only GENERATES C++ and does not compile or time it.")

    print("\nTo compile and run the generated C++ (save optimize.py output as optimized.cpp):\n")
    print("  # With g++ (install via MSYS2/MinGW-w64 on Windows, apt/brew elsewhere):")
    print("  g++ -O3 -std=c++17 -o optimized optimized.cpp")
    print("  ./optimized          # (Windows: optimized.exe)\n")
    print("  # Or with clang++:")
    print("  clang++ -O3 -std=c++17 -o optimized optimized.cpp")
    print("  ./optimized\n")
    print("Time both versions to compare, e.g. Python:")
    print("  python -c \"import time; ...\"   vs   the compiled C++ binary.")
    print("\nThe course typically sees large speedups (often 100x+) with GPT-4o/Claude-grade C++.")


if __name__ == "__main__":
    main()
