@echo off
title GITHUB
git init
git add :/
git commit -m "Initial" -a
set /p url="Repo: "
git remote add origin %url%
git checkout -b main
git push origin main