@echo off
echo ==================================================
echo       GIT PUSH SCRIPT - KDR MULTIMEDIA
echo ==================================================
echo [*] Memeriksa status Git...
if not exist .git (
    echo [*] Menginisialisasi Git Repository baru...
    git init
)

echo [*] Menghubungkan ke GitHub remote repository...
git remote remove origin 2>nul
git remote add origin https://github.com/abadijayacopier/kdr-multimedia.git

echo [*] Mengeluarkan folder build (dist) dari tracking Git...
git rm -r --cached dist 2>nul
git rm -r --cached dist-electron 2>nul

echo [*] Menambahkan file ke staging area...
git add .

echo [*] Membuat commit...
git commit -m "Feat: Add WebRTC layout switching fixes, Electron desktop app, tabbed connection guide, and documentation"

echo [*] Mengatur nama branch ke main...
git branch -M main

echo [*] Melakukan push ke GitHub...
git push -u origin main

echo ==================================================
echo [*] SELESAI! Perubahan berhasil di-push ke GitHub.
echo ==================================================
pause
