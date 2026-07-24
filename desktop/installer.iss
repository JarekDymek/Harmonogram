#ifndef MyAppVersion
  #define MyAppVersion "0.0.0-dev"
#endif

#define MyAppName "Harmonogram MOW"
#define MyAppPublisher "JarekDymek"
#define MyAppExeName "HarmonogramMOW.exe"

[Setup]
AppId={{9E819B59-E9F9-4783-BFA1-694E1C50BB77}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://github.com/JarekDymek/Harmonogram
AppSupportURL=https://github.com/JarekDymek/Harmonogram/issues
AppUpdatesURL=https://github.com/JarekDymek/Harmonogram/releases
DefaultDirName={localappdata}\Programs\Harmonogram MOW
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\release
OutputBaseFilename=Harmonogram-MOW-Setup
SetupIconFile=..\frontend\dist\favicon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
CloseApplications=yes
SetupLogging=yes

[Languages]
Name: "polish"; MessagesFile: "compiler:Languages\Polish.isl"

[Tasks]
Name: "desktopicon"; Description: "Utwórz ikonę na pulpicie"; GroupDescription: "Dodatkowe skróty:"; Flags: unchecked

[Files]
Source: "..\dist\HarmonogramMOW\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Harmonogram MOW"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Harmonogram MOW"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Uruchom Harmonogram MOW"; Flags: nowait postinstall skipifsilent
