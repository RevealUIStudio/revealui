#!/bin/bash
# verify_wsl_setup.sh
# Run this in your WSL terminal (Ubuntu)

echo "Checking WSL-side configuration..."

# 1. Check /etc/wsl.conf
echo "Checking /etc/wsl.conf..."
if [ -f /etc/wsl.conf ]; then
    if grep -q "enabled=true" /etc/wsl.conf && grep -q "appendWindowsPath=true" /etc/wsl.conf; then
        echo -e "\e[32m[OK]\e[0m /etc/wsl.conf has interop enabled"
    else
        echo -e "\e[31m[FAIL]\e[0m /etc/wsl.conf exists but may be missing settings."
        cat /etc/wsl.conf
    fi
else
    echo -e "\e[31m[FAIL]\e[0m /etc/wsl.conf not found"
fi

echo ""

# 2. Check Wrapper Script
echo "Checking ~/.local/bin/agy wrapper..."
if [ -f ~/.local/bin/agy ]; then
    echo -e "\e[32m[OK]\e[0m ~/.local/bin/agy exists"
    if [ -x ~/.local/bin/agy ]; then
        echo -e "\e[32m[OK]\e[0m ~/.local/bin/agy is executable"
    else
        echo -e "\e[31m[FAIL]\e[0m ~/.local/bin/agy is NOT executable (run: chmod +x ~/.local/bin/agy)"
    fi
else
    echo -e "\e[31m[FAIL]\e[0m ~/.local/bin/agy NOT found"
fi

echo ""

# 3. Check System Clock
echo "Checking system clock..."
echo "Current WSL time: $(date)"
echo "Note: If this time is significantly different from your Windows clock, run: sudo ntpdate time.windows.com"

echo ""
echo "Check complete."
