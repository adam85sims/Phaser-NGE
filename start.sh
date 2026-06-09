#!/bin/bash

# Phaser-NGE Startup Script
# This script starts the Vite development server and opens the tools interface.

echo "Starting Phaser-NGE Development Server..."

# Use npm run dev (vite) with the --open flag to target the /tools/ directory.
# This respects the port 3000 configuration in vite.config.js.
npm run dev -- --open /tools/
