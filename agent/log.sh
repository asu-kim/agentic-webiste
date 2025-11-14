#!/bin/bash 



TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DIR="/home/skim638/agentic-website/agent/log"
LOG="$DIR/log_$@.txt"
echo $0 $@ | tee "$LOG"

python "$@" 2>&1 | tee -a "$LOG"

echo "log saved: $LOG"
