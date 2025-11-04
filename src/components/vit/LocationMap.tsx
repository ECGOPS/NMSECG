import { GoogleMap, useLoadScript, Libraries } from '@react-google-maps/api';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';

interface LocationMapProps {
  coordinates: string;
  assetName?: string;
  onLocationChange?: (lat: number, lng: number) => void;
  isEditable?: boolean;
}

const mapContainerStyle = {
  width: '100%',
  height: '300px'
};

const defaultCenter = {
  lat: 5.603717,
  lng: -0.186964
};

const libraries: Libraries = ["places", "marker"];

export function LocationMap({ coordinates, assetName, onLocationChange, isEditable = false }: LocationMapProps) {
  const [position, setPosition] = useState(defaultCenter);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
    mapIds: ['f341f573cd154830316da927']
  });

  // Parse coordinates whenever they change and update position
  useEffect(() => {
    if (coordinates) {
      try {
        const [lat, lng] = coordinates.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          const newPosition = { lat, lng };
          setPosition(newPosition);
          
          // Update marker position if it exists
          if (markerRef.current) {
            markerRef.current.position = newPosition;
          }
          
          // Center map on new position
          if (mapRef.current) {
            mapRef.current.panTo(newPosition);
          }
        }
      } catch (error) {
        console.error('Error parsing coordinates:', error);
      }
    }
  }, [coordinates]);

  const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng && onLocationChange) {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      onLocationChange(newLat, newLng);
    }
  }, [onLocationChange]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    
    // Create pin element with safe innerHTML
    const pinElement = document.createElement('div');
    pinElement.style.cssText = 'width: 24px; height: 24px; cursor: pointer;';
    
    // Define marker color (default red for location markers)
    const markerColor = '#FF0000';
    
    // Sanitize the SVG content before setting innerHTML
    const svgContent = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${markerColor}"/>
        <circle cx="12" cy="9" r="2.5" fill="white"/>
      </svg>
    `;
    pinElement.innerHTML = DOMPurify.sanitize(svgContent);

    // Create the marker element
    const markerView = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
              title: assetName || 'Switchgear Asset Location',
      gmpDraggable: isEditable,
      gmpClickable: true,
      content: pinElement
    });

    // Add click listener to open navigation
    markerView.addListener('click', () => {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${position.lat},${position.lng}`;
      window.open(url, '_blank');
    });

    // Add drag end listener if editable
    if (isEditable) {
      markerView.addListener('dragend', handleMarkerDragEnd);
    }

    markerRef.current = markerView;
  }, [position, assetName, isEditable, handleMarkerDragEnd]);

  const onMapUnmount = useCallback(() => {
    if (markerRef.current) {
      markerRef.current.map = null;
      markerRef.current = null;
    }
    mapRef.current = null;
  }, []);

  const mapOptions = useMemo(() => ({
    mapId: 'f341f573cd154830316da927',
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: true,
    gestureHandling: 'greedy'
  }), []);

  if (loadError) {
    return (
      <div className="text-muted-foreground p-4 border border-destructive rounded-md">
        Error loading maps: {loadError.message}
        <br />
        Please check your internet connection and ensure the Google Maps API key is valid.
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="text-muted-foreground">Loading maps...</div>;
  }

  // Don't show the map if no coordinates are available
  if (!coordinates) {
    return null;
  }

  return (
    <div className="relative h-[300px] w-full rounded-md overflow-hidden border border-border">
      <div 
        className="absolute top-2 left-2 z-10 bg-red-500/80 backdrop-blur-sm px-2 py-1 text-xs text-white rounded-md cursor-pointer hover:bg-red-600/80 transition-colors"
        onClick={() => {
          const url = `https://www.google.com/maps/dir/?api=1&destination=${position.lat},${position.lng}`;
          window.open(url, '_blank');
        }}
        title="Click to open in Google Maps"
      >
        {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
      </div>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={position}
        zoom={15}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        options={mapOptions}
      />
    </div>
  );
} 