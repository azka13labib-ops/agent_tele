Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "c:\ngodink\tele-hermes-bot"
WshShell.Run "node c:\ngodink\tele-hermes-bot\laptop_worker.js", 0, False
