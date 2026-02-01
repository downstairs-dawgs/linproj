#!/bin/bash
# Demo script for asciinema recording

clear
echo "# linproj 0.6.0 - Terminal Markdown Rendering"
echo
sleep 3

echo "# View an issue with rich markdown formatting"
echo
sleep 2
echo "$ linproj issues get ENG-517"
sleep 1
linproj issues get ENG-517
sleep 5

clear
echo "# View threaded comments with markdown"
echo
sleep 2
echo "$ linproj issues comments ENG-517"
sleep 1
linproj issues comments ENG-517
sleep 5

clear
echo "# Reply to the most recent comment"
echo
sleep 2
echo '$ linproj issues comments add ENG-517 --reply-to last "Looks good!"'
sleep 2

clear
echo "# Resolved threads collapse to a single line"
echo
sleep 2
echo "$ linproj issues comment resolve <comment-id>"
sleep 3
