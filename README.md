<p align="center">
  <img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-wordmark-logo-vertical.png" width="150" alt="Homebridge">
</p>

<h1 align="center">homebridge-simple-ir-fan</h1>

A Homebridge dynamic platform plugin (TypeScript) to expose an IR-controlled ceiling/stand fan to Apple Home. It bridges basic fan functions via HomeKit, mapping IR commands (power, speed, swing, etc.) through configurable commands.

Note: This template targets Homebridge v1 and v2.

## Features
- Dynamic platform with discover/register flow
- TypeScript build with strict ESLint
- Hot-reload dev workflow (watch + auto Homebridge restart)
- Homebridge UI config schema for guided setup

## Requirements
- Node.js 18+
- Homebridge installed globally
- An IR blaster supported by your setup (e.g., via command hooks or external scripts)

## Installation
In the project directory:
- npm install

Global link for local testing:
- npm link

## Configuration
Configure the plugin in Homebridge UI or via JSON. See:
- config.schema.json (UI-driven fields)
- config.example.json (text example)

Typical minimal JSON (adapt to your IR stack):
{
"platforms": [
{
"platform": "SimpleIRFanPlatform",
"name": "Simple IR Fan",
"devices": [
{
"name": "Living Room Fan",
"commands": {
"powerOn": "your-ir-command-here",
"powerOff": "your-ir-command-here",
"speedLow": "your-ir-command-here",
"speedMedium": "your-ir-command-here",
"speedHigh": "your-ir-command-here",
"swingToggle": "your-ir-command-here"
}
}
]
}
]
}

Ensure the platform value matches the schema/platform settings in your codebase.

## Scripts
- Build:
    - npm run build
- Watch (auto build + auto restart Homebridge using nodemon):
    - npm run watch
- Lint:
    - npm run lint
- Clean:
    - npm run clean

## Local Development
1) Link the plugin:
- npm link

2) Add your platform to a Homebridge config (example test/hbConfig or your local Homebridge config):
   {
   "platforms": [
   { "name": "Config", "port": 8581, "platform": "config" },
   {
   "name": "Simple IR Fan",
   "platform": "SimpleIRFanPlatform"
   }
   ]
   }

3) Start watch mode:
- npm run watch

4) Run Homebridge in debug (separate terminal if not using watch-integrated start):
- homebridge -D

Notes:
- Ensure no other Homebridge instance is running
- You can tweak nodemon.json to adjust startup behavior

## Development Layout
- src/: platform, accessory, settings, and helpers
- config.schema.json: UI config for Homebridge Config UI X
- config.example.json: example JSON for manual config
- dist/: compiled output

## Versioning
Follow SemVer.
- MAJOR: breaking changes
- MINOR: features
- PATCH: fixes

Bump versions:
- npm version major
- npm version minor
- npm version patch

## Publish
Before publishing:
- Ensure package.json metadata is set (name, displayName, repository, bugs, homepage)
- Remove "private" or set to false
- npm publish

For first-time scoped packages:
- npm publish --access=public

### Beta releases
- npm version prepatch --preid beta
- npm publish --tag beta

Install beta globally:
- sudo npm install -g your-scope/your-package@beta

## Best Practices
- Do not start devices until configured
- Support current LTS Node.js
- No post-install scripts modifying the system
- Implement Homebridge UI schema
- Store files only in Homebridge storage dir
- Log and handle errors; avoid unhandled exceptions
- No analytics/tracking

## License
Apache License 2.0

## Author
Ionut-Alexandru Banica

## Support
- Homebridge Docs: https://developers.homebridge.io/
- Verified plugin guidance: https://github.com/homebridge/verified#requirements