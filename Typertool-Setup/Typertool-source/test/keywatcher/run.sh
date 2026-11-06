#!/bin/sh
# Compiles ext/keys/KeyWatcher.cs with the C# 5 language level of Windows PowerShell and runs its logic
# against a fake keyboard (needs mono: apt install mono-mcs mono-runtime)
cd "$(dirname "$0")" && mcs -langversion:5 -out:/tmp/kw.exe ../../ext/keys/KeyWatcher.cs KeyWatcherTest.cs && mono /tmp/kw.exe
