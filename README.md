# AudioServer
 - Store audio file in server
 - Get audio list on server:[PORT]/infos
 - Manage server on server:[PORT]/manage
 - CMD Manager
 
You can download playlist and video (converted to .mp3) from CMD
You can upload audio from server:[PORT]/manage (You need activate admin mode in CMD before !)
You can delete audio from server:[PORT]/manage (You need activate admin mode in CMD before !)


# Dependencies 
(nodejs)
 - HTTP
 - FS
 - PATH
 - SOCKET IO
 - FORMIDABLE
 - NODE:READLINE
 
 - -> `npm i http fs path socket.io formidable node:readline`
(python)
 - Last version of python (https://www.python.org/downloads/)
 - YT_DLP -> `python3 -m pip install -U "yt-dlp[default]"` (https://github.com/yt-dlp/yt-dlp/wiki/Installation)
