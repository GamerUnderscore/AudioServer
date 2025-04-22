import os
import json
import string
from yt_dlp import YoutubeDL
import sys

output_dir = "musics/"
info_file = "info.json"

os.makedirs(output_dir, exist_ok=True)

if os.path.exists(info_file):
    with open(info_file, "r", encoding="utf-8") as f:
        info_data = json.load(f)
else:
    info_data = []



def process_playlist(playlist_url):
    ydl_opts = {
        'ignoreerrors': True,
    }

    with YoutubeDL(ydl_opts) as ydl:
        playlist_info = ydl.extract_info(playlist_url, download=False)

    if 'entries' in playlist_info:
        print(f"Playlist : {playlist_info['title']}")
        for video in playlist_info['entries']:
            if video['id'] is None:
                print("ID de la vidéo introuvable, on skip.")
                continue

            video_url = f"https://www.youtube.com/watch?v={video['id']}"
            try:
                info = download_audio(video_url)
                display_table(info)
            except Exception as e:
                print(f"Erreur lors du traitement de la vidéo {video['id']} : {e}")

def download_audio(url):
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f'musics/%(id)s.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '2',

        }],
        'audio-quality': '2',
        'prefer_ffmpeg': True,
        'keepvideo': False,
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return info

def display_table(info):
    title = info.get('title', 'Unknown Title')
    duration = info.get('duration', 0)

    video_data = {
        'path': info['id'] + ".mp3",
        'name': title,
        'duration': duration,
    }
    info_data.append(video_data)
    with open(info_file, "w", encoding="utf-8") as f:
        json.dump(info_data, f, ensure_ascii=False, indent=4)

if len(sys.argv) > 1:
    url = sys.argv[1]
    videoUnique = sys.argv[2]
    try:
        if videoUnique == "unique":
            info = download_audio(url)
            display_table(info)
        else:
            process_playlist(url)

        
        sys.exit(0)
    except Exception as e:
        print(f"Erreur : {e}")
        sys.exit(1)
else:
    def main():
        while True:
            url = input("Entrez l'URL de la vidéo : ")
            if not url:
                print("URL non valide. Essayez à nouveau.")
                continue
            try:
                
                process_playlist(url)
            
            except Exception as e:
                print(f"Erreur : {e}")
                continue
    if __name__ == "__main__":
        main()



