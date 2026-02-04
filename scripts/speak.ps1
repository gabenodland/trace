param([string]$text, [string]$voice = "Microsoft Zira Desktop")
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice($voice)
$synth.Speak($text)
