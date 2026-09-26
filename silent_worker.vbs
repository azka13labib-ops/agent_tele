Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "c:\ngodink\tele-hermes-bot"
WshShell.Run """C:\Program Files\nodejs\node.exe"" ""c:\ngodink\tele-hermes-bot\laptop_worker.js""", 0, False
