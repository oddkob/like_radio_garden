#!/usr/bin/env python3
"""
Radio Garden Desktop Application
A native desktop app for exploring global radio stations
"""

import os
import sys
import webview
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import threading
import json
import random
import requests
from pathlib import Path

# Add project root to path
if getattr(sys, 'frozen', False):
    template_dir = os.path.join(sys._MEIPASS, 'templates')
    static_dir = os.path.join(sys._MEIPASS, 'static')
else:
    template_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')

app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
CORS(app)

# Station database with real streaming URLs
STATIONS = [
    {"id": 1, "name": "BBC Radio 1", "country": "United Kingdom", "city": "London", 
     "lat": 51.5074, "lon": -0.1278, "genre": "Pop", "url": "http://stream.live.vc.bbcmedia.co.uk/bbc_radio_one", 
     "bitrate": "128kbps", "listeners": "2.4M", "language": "English"},
    {"id": 2, "name": "KEXP 90.3 FM", "country": "USA", "city": "Seattle", 
     "lat": 47.6062, "lon": -122.3321, "genre": "Alternative", "url": "https://kexp-mp3-128.streamguys1.com/kexp128.mp3", 
     "bitrate": "128kbps", "listeners": "180K", "language": "English"},
    {"id": 3, "name": "FIP Radio", "country": "France", "city": "Paris", 
     "lat": 48.8566, "lon": 2.3522, "genre": "Eclectic", "url": "https://stream.radiofrance.fr/fip/fip.m3u8", 
     "bitrate": "192kbps", "listeners": "420K", "language": "French"},
    {"id": 4, "name": "NHK World", "country": "Japan", "city": "Tokyo", 
     "lat": 35.6762, "lon": 139.6503, "genre": "News/Talk", "url": "https://nhkworld.webcdn.stream.ne.jp/www11/nhkworld-tv/live.m3u8", 
     "bitrate": "256kbps", "listeners": "1.1M", "language": "Japanese/English"},
    {"id": 5, "name": "Radio Paradise", "country": "USA", "city": "San Francisco", 
     "lat": 37.7749, "lon": -122.4194, "genre": "Rock", "url": "http://stream.radioparadise.com/mp3-192", 
     "bitrate": "192kbps", "listeners": "95K", "language": "English"},
    {"id": 6, "name": "Triple J", "country": "Australia", "city": "Sydney", 
     "lat": -33.8688, "lon": 151.2093, "genre": "Alternative", "url": "https://live-radio01.mediahubaustralia.com/2TJW/mp3/", 
     "bitrate": "128kbps", "listeners": "1.8M", "language": "English"},
    {"id": 7, "name": "Radio 3FM", "country": "Netherlands", "city": "Amsterdam", 
     "lat": 52.3676, "lon": 4.9041, "genre": "Top 40", "url": "https://icecast.omroep.nl/3fm-bb-mp3", 
     "bitrate": "192kbps", "listeners": "890K", "language": "Dutch"},
    {"id": 8, "name": "KCRW", "country": "USA", "city": "Los Angeles", 
     "lat": 34.0522, "lon": -118.2437, "genre": "Eclectic", "url": "https://kcrw.streamguys1.com/kcrw_192k_mp3_on_air_internet_radio", 
     "bitrate": "192kbps", "listeners": "550K", "language": "English"},
    {"id": 9, "name": "Radio Nova", "country": "France", "city": "Paris", 
     "lat": 48.8589, "lon": 2.3464, "genre": "Electronic", "url": "https://novazz.ice.infomaniak.ch/novazz-128.mp3", 
     "bitrate": "128kbps", "listeners": "320K", "language": "French"},
    {"id": 10, "name": "CBC Radio 1", "country": "Canada", "city": "Toronto", 
     "lat": 43.6532, "lon": -79.3832, "genre": "News", "url": "https://cbcradiolive.akamaized.net/hls/live/2041057/ES_R1_TOR/adaptive_192/chunklist_ao.m3u8", 
     "bitrate": "192kbps", "listeners": "2.1M", "language": "English"},
    {"id": 11, "name": "Radio Swiss Jazz", "country": "Switzerland", "city": "Bern", 
     "lat": 46.9480, "lon": 7.4474, "genre": "Jazz", "url": "http://stream.srg-ssr.ch/m/rsj/mp3_128", 
     "bitrate": "128kbps", "listeners": "75K", "language": "Multilingual"},
    {"id": 12, "name": "WFMU", "country": "USA", "city": "New Jersey", 
     "lat": 40.0583, "lon": -74.4057, "genre": "Freeform", "url": "https://stream0.wfmu.org/freeform-128k", 
     "bitrate": "128kbps", "listeners": "45K", "language": "English"},
    {"id": 13, "name": "Radio Bremen", "country": "Germany", "city": "Bremen", 
     "lat": 53.0793, "lon": 8.8017, "genre": "Classical", "url": "https://icecast.radiobremen.de/rb/bremenvier/live/mp3/128/stream.mp3", 
     "bitrate": "128kbps", "listeners": "120K", "language": "German"},
    {"id": 14, "name": "Radio New Zealand", "country": "New Zealand", "city": "Auckland", 
     "lat": -36.8485, "lon": 174.7633, "genre": "Public", "url": "https://stream.radionz.co.nz/national/national/playlist.m3u8", 
     "bitrate": "128kbps", "listeners": "380K", "language": "English"},
    {"id": 15, "name": "Rádio Globo", "country": "Brazil", "city": "Rio de Janeiro", 
     "lat": -22.9068, "lon": -43.1729, "genre": "Talk", "url": "https://medias.sgr.globo.com/hls/radiooglobo/playlist.m3u8", 
     "bitrate": "128kbps", "listeners": "2.8M", "language": "Portuguese"},
    {"id": 16, "name": "Radio City", "country": "India", "city": "Mumbai", 
     "lat": 19.0760, "lon": 72.8777, "genre": "Bollywood", "url": "https://prclive1.listenon.in/RadioCity", 
     "bitrate": "128kbps", "listeners": "4.2M", "language": "Hindi"},
    {"id": 17, "name": "Kiss FM", "country": "Romania", "city": "Bucharest", 
     "lat": 44.4268, "lon": 26.1025, "genre": "Dance", "url": "https://live.kissfm.ro/kissfm.aacp", 
     "bitrate": "128kbps", "listeners": "290K", "language": "Romanian"},
    {"id": 18, "name": "Radio Metro", "country": "Norway", "city": "Oslo", 
     "lat": 59.9139, "lon": 10.7522, "genre": "Pop", "url": "https://metro.ice.infomaniak.ch/metro-128.mp3", 
     "bitrate": "128kbps", "listeners": "150K", "language": "Norwegian"},
    {"id": 19, "name": "FluxFM", "country": "Germany", "city": "Berlin", 
     "lat": 52.5200, "lon": 13.4050, "genre": "Indie", "url": "https://streams.fluxfm.de/live/mp3-320/audio.mp3", 
     "bitrate": "320kbps", "listeners": "95K", "language": "German"},
    {"id": 20, "name": "Radio María", "country": "Italy", "city": "Rome", 
     "lat": 41.9028, "lon": 12.4964, "genre": "Religious", "url": "http://dreamsiteradiocp2.com:8028/stream", 
     "bitrate": "128kbps", "listeners": "500K", "language": "Italian"},
    {"id": 21, "name": "Radio 1", "country": "Belgium", "city": "Brussels", 
     "lat": 50.8503, "lon": 4.3517, "genre": "Top 40", "url": "https://icecast.vrtcdn.be/radio1-high.mp3", 
     "bitrate": "192kbps", "listeners": "680K", "language": "Dutch"},
    {"id": 22, "name": "Radio Österreich 1", "country": "Austria", "city": "Vienna", 
     "lat": 48.2082, "lon": 16.3738, "genre": "Classical", "url": "https://orf-live.ors-shoutcast.at/oe1-q2a", 
     "bitrate": "192kbps", "listeners": "420K", "language": "German"},
    {"id": 23, "name": "Radio Helsinki", "country": "Finland", "city": "Helsinki", 
     "lat": 60.1699, "lon": 24.9384, "genre": "Alternative", "url": "https://stream.radiohelsinki.fi/", 
     "bitrate": "128kbps", "listeners": "85K", "language": "Finnish"},
    {"id": 24, "name": "Radio Prague", "country": "Czech Republic", "city": "Prague", 
     "lat": 50.0755, "lon": 14.4378, "genre": "News", "url": "https://rozhlas.stream/radiozurnal_high.aac", 
     "bitrate": "128kbps", "listeners": "310K", "language": "Czech"},
    {"id": 25, "name": "Radio Marte", "country": "Portugal", "city": "Lisbon", 
     "lat": 38.7223, "lon": -9.1393, "genre": "Fado", "url": "https://stream-icy.bauermedia.pt/marte.mp3", 
     "bitrate": "128kbps", "listeners": "140K", "language": "Portuguese"}
]

# Current playback state
current_playback = {
    "station_id": None,
    "is_playing": False,
    "volume": 0.8
}

class RadioPlayer:
    """Python backend audio player using pygame"""
    def __init__(self):
        try:
            import pygame
            pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=4096)
            self.pygame = pygame
            self.initialized = True
        except ImportError:
            print("Warning: pygame not available, audio playback disabled")
            self.initialized = False
    
    def play(self, url):
        """Start playing a radio stream"""
        if not self.initialized:
            return False
        
        try:
            self.pygame.mixer.music.stop()
            self.pygame.mixer.music.load(url)
            self.pygame.mixer.music.play(-1)  # Loop indefinitely
            return True
        except Exception as e:
            print(f"Playback error: {e}")
            return False
    
    def stop(self):
        """Stop playback"""
        if self.initialized:
            self.pygame.mixer.music.stop()
    
    def set_volume(self, volume):
        """Set volume (0.0 to 1.0)"""
        if self.initialized:
            self.pygame.mixer.music.set_volume(volume)
            current_playback["volume"] = volume

# Initialize player
player = RadioPlayer()

@app.route('/')
def index():
    """Serve main application page"""
    return render_template('index.html')

@app.route('/api/stations')
def get_stations():
    """Get all radio stations"""
    return jsonify(STATIONS)

@app.route('/api/stations/<int:station_id>')
def get_station(station_id):
    """Get specific station"""
    station = next((s for s in STATIONS if s["id"] == station_id), None)
    if station:
        return jsonify(station)
    return jsonify({"error": "Station not found"}), 404

@app.route('/api/stations/nearby')
def get_nearby_stations():
    """Get stations near coordinates"""
    lat = float(request.args.get('lat', 0))
    lon = float(request.args.get('lon', 0))
    radius = float(request.args.get('radius', 10))
    
    nearby = []
    for station in STATIONS:
        # Simple distance calculation (not haversine for demo)
        dist = ((station["lat"] - lat) ** 2 + (station["lon"] - lon) ** 2) ** 0.5
        if dist <= radius:
            nearby.append({**station, "distance": round(dist, 2)})
    
    return jsonify(sorted(nearby, key=lambda x: x["distance"]))

@app.route('/api/play', methods=['POST'])
def play_station():
    """Start playing a station"""
    data = request.get_json()
    station_id = data.get('station_id')
    
    station = next((s for s in STATIONS if s["id"] == station_id), None)
    if not station:
        return jsonify({"error": "Station not found"}), 404
    
    # Try to play via Python backend
    success = player.play(station["url"])
    
    current_playback["station_id"] = station_id
    current_playback["is_playing"] = True
    
    return jsonify({
        "success": success,
        "station": station,
        "playback": current_playback
    })

@app.route('/api/stop', methods=['POST'])
def stop_playback():
    """Stop playback"""
    player.stop()
    current_playback["is_playing"] = False
    current_playback["station_id"] = None
    return jsonify({"success": True, "playback": current_playback})

@app.route('/api/volume', methods=['POST'])
def set_volume():
    """Set volume"""
    data = request.get_json()
    volume = data.get('volume', 0.8)
    player.set_volume(volume)
    return jsonify({"success": True, "volume": volume})

@app.route('/api/random')
def get_random_station():
    """Get a random station"""
    return jsonify(random.choice(STATIONS))

@app.route('/api/search')
def search_stations():
    """Search stations by name, country, genre"""
    query = request.args.get('q', '').lower()
    results = [s for s in STATIONS if 
               query in s["name"].lower() or 
               query in s["country"].lower() or 
               query in s["genre"].lower() or
               query in s["city"].lower()]
    return jsonify(results)

class Api:
    """JavaScript API bridge for pywebview"""
    def __init__(self):
        self.player = player
        self.stations = STATIONS
    
    def get_stations(self):
        return self.stations
    
    def play(self, station_id):
        station = next((s for s in self.stations if s["id"] == station_id), None)
        if station:
            return player.play(station["url"])
        return False
    
    def stop(self):
        player.stop()
    
    def set_volume(self, volume):
        player.set_volume(volume)
    
    def get_random(self):
        return random.choice(self.stations)
    
    def minimize_window(self):
        window.minimize()
    
    def toggle_fullscreen(self):
        window.toggle_fullscreen()
    
    def close_window(self):
        window.destroy()

def start_server():
    """Start Flask server in background thread"""
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

if __name__ == '__main__':
    # Start Flask server in background
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Create API bridge
    api = Api()
    
    # Create window
    global window
    window = webview.create_window(
        'Radio Garden Desktop',
        'http://127.0.0.1:5000',
        width=1400,
        height=900,
        min_size=(1000, 700),
        resizable=True,
        fullscreen=False,
        frameless=False,
        easy_drag=True,
        js_api=api
    )
    
    # Start webview
    webview.start(debug=False)