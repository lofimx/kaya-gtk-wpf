#!/bin/bash

# ==============================================================================
# ThinkPad X1 Carbon Gen 9 - Windows 10 USB Installer with Drivers (Debian 13)
# ==============================================================================
# PREREQUISITES (Run these once):
#   sudo apt update && sudo apt install wimtools p7zip-full rsync wget coreutils parted dosfstools
#
# INSTRUCTIONS:
#   0. Find USB device: lsblk
#   1. Place your official 'Win10.iso' in the same folder as this script.
#   2. Run: chmod +x slipstream.sh
#   3. Run: sudo ./slipstream.sh /dev/sdX  (Replace X with your USB drive letter)
#
# WHAT THIS SCRIPT DOES:
#   - Downloads Intel VMD (Storage), Wi-Fi, and Serial IO (Touchpad) drivers.
#   - Extracts the ISO and places drivers in the $WinPEDriver$ folder.
#     (Windows Setup automatically scans this folder for drivers during both
#     the WinPE setup phase and the offline servicing phase of installation.)
#   - Formats the target USB as FAT32 with an MBR partition table.
#   - Splits install.wim if it exceeds the 4GB FAT32 file size limit.
#   - Copies all files to the USB.
#
# NOTE: The original script injected drivers into boot.wim and install.wim
#   via 'wimlib-imagex update ... add /Windows/INF'. This is incorrect:
#   simply copying files into /Windows/INF does not register them in the
#   Windows driver store. The $WinPEDriver$ method is the officially
#   supported way to add drivers to Windows installation media.
#
# ALTERNATIVE: Instead of slipstreaming the Intel VMD driver, you can
#   disable VMD in the ThinkPad BIOS (UEFI Setup > Config > Storage >
#   Controller Mode > set to AHCI). This makes the NVMe SSD visible to
#   Windows Setup without any extra drivers, but is a permanent BIOS change.
# ==============================================================================

set -euo pipefail

# --- Configuration ---
ISO_NAME="Win10.iso"
TARGET_USB="${1:-}"
WORK_DIR="./win_temp"
DRIVER_DIR="./drivers"
DL_DIR="./downloads"
MNT_USB="/mnt/win_usb_mount"

# Driver download URLs (Intel and Lenovo official CDN).
# If any URL returns a 404, the script prints fallback instructions
# with the canonical download page for manual download.

# Intel RST 18.7.6 for 10th/11th Gen — contains the VMD F6 setup driver.
# Source: https://www.intel.com/content/www/us/en/download/19512/
RST_URL="https://downloadmirror.intel.com/773229/SetupRST.exe"
RST_FILE="SetupRST.exe"

# Intel Wi-Fi 6 AX201 driver (supports AX200/AX201/AX210/AX211 and others).
# Source: https://www.intel.com/content/www/us/en/download/19351/
WIFI_URL="https://downloadmirror.intel.com/871633/WiFi-24.10.0-Driver64-Win10-Win11.exe"
WIFI_FILE="WiFi.exe"

# Intel Serial IO (I2C host controller for touchpad) — Lenovo package
# specifically for the ThinkPad X1 Carbon 9th Gen / X1 Yoga 6th Gen.
# Source: https://support.lenovo.com/us/en/downloads/ds548761
SERIALIO_URL="https://download.lenovo.com/pccbbs/mobiles/n32li04w.exe"
SERIALIO_FILE="SerialIO.exe"

# --- 1. Validation ---
if [[ $EUID -ne 0 ]]; then
    echo "Error: This script must be run as root (sudo) to format the USB."
    exit 1
fi

if [[ -z "$TARGET_USB" || ! -b "$TARGET_USB" ]]; then
    echo "Error: Please specify a valid USB block device (e.g., /dev/sdb)."
    echo "Usage: sudo $0 /dev/sdX"
    echo ""
    echo "List devices with: lsblk"
    exit 1
fi

# Safety check: refuse to operate on anything that looks like a system disk
# was: if [[ "$TARGET_USB" == "/dev/sda" || "$TARGET_USB" == "/dev/nvme"* ]]; then
# this machine is /dev/sda for USB, though
if [[ "$TARGET_USB" == "/dev/nvme"* ]]; then
    echo "Error: Refusing to operate on $TARGET_USB (looks like a system disk)."
    echo "Please specify a USB device (typically /dev/sdb, /dev/sdc, etc.)."
    exit 1
fi

if [[ ! -f "$ISO_NAME" ]]; then
    echo "Error: $ISO_NAME not found in the current directory."
    echo "Download a Windows 10 ISO from Microsoft and place it here."
    exit 1
fi

# Confirm with user
echo "WARNING: This will ERASE ALL DATA on $TARGET_USB."
lsblk "$TARGET_USB" 2>/dev/null || true
echo ""
read -p "Proceed? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# --- 2. Download Drivers ---
echo ""
echo "=== Step 1: Downloading drivers ==="
mkdir -p "$DL_DIR"

download_driver() {
    local url="$1"
    local dest="$2"
    local name="$3"
    local fallback_page="$4"

    if [[ -f "$dest" ]] && [[ -s "$dest" ]]; then
        echo "  $name: already downloaded, skipping."
        return 0
    fi

    echo "  $name: downloading..."
    if wget -q --show-progress --timeout=30 -O "$dest" "$url" 2>&1; then
        if [[ -s "$dest" ]]; then
            echo "  $name: OK ($(du -h "$dest" | cut -f1))"
            return 0
        fi
    fi

    rm -f "$dest"
    echo ""
    echo "ERROR: Failed to download $name."
    echo "The CDN URL may have changed. Please download manually from:"
    echo "  $fallback_page"
    echo ""
    echo "Save the file as: $dest"
    echo "Then re-run this script."
    exit 1
}

download_driver "$RST_URL" "$DL_DIR/$RST_FILE" \
    "Intel RST/VMD (storage)" \
    "https://www.intel.com/content/www/us/en/download/19512/"

download_driver "$WIFI_URL" "$DL_DIR/$WIFI_FILE" \
    "Intel Wi-Fi 6 AX201" \
    "https://www.intel.com/content/www/us/en/download/19351/"

download_driver "$SERIALIO_URL" "$DL_DIR/$SERIALIO_FILE" \
    "Intel Serial IO (touchpad)" \
    "https://support.lenovo.com/us/en/downloads/ds548761"

# --- 3. Extract Drivers ---
echo ""
echo "=== Step 2: Extracting drivers ==="
rm -rf "$DRIVER_DIR"
mkdir -p "$DRIVER_DIR"

echo "  Extracting Intel RST (VMD)..."
7z x -y -bd "$DL_DIR/$RST_FILE" -o"$DRIVER_DIR/storage" > /dev/null

echo "  Extracting Intel Wi-Fi..."
7z x -y -bd "$DL_DIR/$WIFI_FILE" -o"$DRIVER_DIR/wifi" > /dev/null

echo "  Extracting Intel Serial IO..."
7z x -y -bd "$DL_DIR/$SERIALIO_FILE" -o"$DRIVER_DIR/touchpad" > /dev/null

# Verify that .inf driver files were found in each extraction
for subdir in storage wifi touchpad; do
    inf_count=$(find "$DRIVER_DIR/$subdir" -iname "*.inf" | wc -l)
    if [[ "$inf_count" -eq 0 ]]; then
        echo "  WARNING: No .inf driver files found in $subdir extraction."
        echo "  The driver package format may have changed."
    else
        echo "  $subdir: found $inf_count .inf file(s)"
    fi
done

# --- 4. Extract ISO ---
echo ""
echo "=== Step 3: Extracting ISO ==="
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
7z x -y -bd "$ISO_NAME" -o"$WORK_DIR" > /dev/null
echo "  ISO extracted to $WORK_DIR"

# --- 5. Add Drivers via $WinPEDriver$ ---
# Windows Setup automatically and recursively scans the $WinPEDriver$ folder
# at the root of the installation media for .inf driver packages. Drivers
# found here are:
#   - Loaded into WinPE (so the NVMe SSD is visible during setup)
#   - Imported into the Windows driver store during offline servicing
#     (so they're available in the installed OS from first boot)
#
# This replaces the incorrect approach of injecting files into boot.wim or
# install.wim via wimlib-imagex. That approach just copies files into the
# WIM filesystem without registering them in the driver store.
echo ""
echo "=== Step 4: Adding drivers to \$WinPEDriver\$ ==="

WINPE_DRV="$WORK_DIR/\$WinPEDriver\$"
mkdir -p "$WINPE_DRV/storage"
mkdir -p "$WINPE_DRV/wifi"
mkdir -p "$WINPE_DRV/touchpad"

# Copy entire extracted trees — Windows PE recursively scans for .inf files,
# so extra non-driver files are harmless.
cp -r "$DRIVER_DIR/storage/"* "$WINPE_DRV/storage/"
cp -r "$DRIVER_DIR/wifi/"* "$WINPE_DRV/wifi/"
cp -r "$DRIVER_DIR/touchpad/"* "$WINPE_DRV/touchpad/"

total_inf=$(find "$WINPE_DRV" -iname "*.inf" | wc -l)
echo "  $total_inf .inf driver files staged in \$WinPEDriver\$"

# --- 6. Split install.wim if needed ---
# FAT32 has a 4GB maximum file size. Multi-edition Windows 10 ISOs often
# have an install.wim larger than 4GB. wimlib-imagex can split it into
# chunks that Windows Setup knows how to reassemble.
# ISOs using install.esd (compressed) are typically already under 4GB.
echo ""
echo "=== Step 5: Checking install image size ==="

INSTALL_WIM="$WORK_DIR/sources/install.wim"
if [[ -f "$INSTALL_WIM" ]]; then
    WIM_SIZE=$(stat -c%s "$INSTALL_WIM")
    WIM_MB=$(( WIM_SIZE / 1024 / 1024 ))
    MAX_FAT32=4294967295  # 4GB - 1 byte

    if [[ "$WIM_SIZE" -gt "$MAX_FAT32" ]]; then
        echo "  install.wim is ${WIM_MB} MB (exceeds FAT32 limit), splitting..."
        wimlib-imagex split "$INSTALL_WIM" "$WORK_DIR/sources/install.swm" 3800
        rm "$INSTALL_WIM"
        echo "  Split into $(ls "$WORK_DIR/sources/"install*.swm | wc -l) parts."
    else
        echo "  install.wim is ${WIM_MB} MB, no split needed."
    fi
elif [[ -f "$WORK_DIR/sources/install.esd" ]]; then
    ESD_SIZE=$(stat -c%s "$WORK_DIR/sources/install.esd")
    echo "  ISO uses install.esd ($(( ESD_SIZE / 1024 / 1024 )) MB), no split needed."
else
    echo "  WARNING: Neither install.wim nor install.esd found in ISO."
fi

# --- 7. Format USB ---
echo ""
echo "=== Step 6: Formatting USB drive ==="

# Unmount any existing mounts
umount "${TARGET_USB}"* 2>/dev/null || true

# Create MBR partition table with a single FAT32 (LBA) partition.
# MBR is used for maximum compatibility — UEFI firmware can boot from
# MBR FAT32 partitions, and this also works with legacy BIOS/CSM.
echo "  Wiping signatures on $TARGET_USB..."
wipefs -a "$TARGET_USB"

echo "  Creating MBR partition table on $TARGET_USB..."
sfdisk "$TARGET_USB" << EOF
label: dos
type=c, bootable
EOF

# Wait for the kernel to re-read the partition table and the
# partition device node (e.g. /dev/sda1) to appear.
partprobe "$TARGET_USB" 2>/dev/null || true
for i in $(seq 1 10); do
    [ -b "${TARGET_USB}1" ] && break
    echo "  Waiting for ${TARGET_USB}1 to appear... ($i)"
    sleep 1
done

if [[ ! -b "${TARGET_USB}1" ]]; then
    echo "Error: Partition ${TARGET_USB}1 did not appear after partitioning."
    echo "Try running: partprobe $TARGET_USB"
    exit 1
fi

echo "  Formatting ${TARGET_USB}1 as FAT32..."
mkfs.vfat -F 32 -n "WIN10" "${TARGET_USB}1"

# --- 8. Copy Files to USB ---
echo ""
echo "=== Step 7: Copying files to USB ==="

mkdir -p "$MNT_USB"
mount "${TARGET_USB}1" "$MNT_USB"

# Use rsync for reliable copy with progress
rsync -ah --info=progress2 "$WORK_DIR/" "$MNT_USB/"
sync

echo "  Copy complete."

# --- 9. Cleanup ---
umount "$MNT_USB"
rmdir "$MNT_USB"

echo ""
echo "=========================================================================="
echo " SUCCESS! Windows 10 installer with drivers is ready on $TARGET_USB"
echo "=========================================================================="
echo ""
echo " Drivers included via \$WinPEDriver\$:"
echo "   - Intel RST VMD (NVMe storage — SSD visible during setup)"
echo "   - Intel Wi-Fi 6 AX201 (wireless networking)"
echo "   - Intel Serial IO I2C (touchpad support)"
echo ""
echo " To install Windows:"
echo "   1. Plug USB into the ThinkPad X1 Carbon Gen 9."
echo "   2. Power on and tap F12 for the boot menu."
echo "   3. Select the USB device (UEFI mode)."
echo "   4. The SSD, Wi-Fi, and touchpad should work during setup."
echo ""
echo " Optional cleanup: rm -rf $WORK_DIR $DRIVER_DIR"
echo "=========================================================================="
