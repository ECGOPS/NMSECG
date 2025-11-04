import { GoogleMap, useLoadScript, Libraries } from '@react-google-maps/api';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { VITAsset } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Navigation, Info, Filter, Search, X } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import DOMPurify from 'dompurify';
import { SafeHTML } from '@/components/ui/safe-display';

interface VITMapViewProps {
  assets: VITAsset[];
  onAssetClick?: (asset: VITAsset) => void;
  selectedRegion?: string;
  selectedDistrict?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '600px'
};

const defaultCenter = {
  lat: 5.603717,
  lng: -0.186964
};

const libraries: Libraries = ["places", "marker"];

interface MapMarker {
  asset: VITAsset;
  marker: google.maps.marker.AdvancedMarkerElement;
  infoWindow: google.maps.InfoWindow;
}

export function VITMapView({ assets, onAssetClick, selectedRegion, selectedDistrict }: VITMapViewProps) {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<VITAsset | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<MapMarker[]>([]);
  const navigate = useNavigate();
  
  // Filter states
  const [mapSelectedRegion, setMapSelectedRegion] = useState<string>(selectedRegion || "all");
  const [mapSelectedDistrict, setMapSelectedDistrict] = useState<string>(selectedDistrict || "all");
  const [mapSelectedType, setMapSelectedType] = useState<string>("all");
  const [mapSearchTerm, setMapSearchTerm] = useState<string>("");
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState<boolean>(true);
  
  const { regions, districts } = useData();

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
    mapIds: ['f341f573cd154830316da927']
  });

  // Handle asset click to navigate to details page
  const handleAssetClick = useCallback((asset: VITAsset) => {
    navigate(`/asset-management/vit-inspection-details/${asset.id}`);
  }, [navigate]);

  // Filter assets based on region, district, type, and search
  const filteredAssets = useMemo(() => {
    let filtered = assets;
    
    if (mapSelectedRegion && mapSelectedRegion !== "all") {
      filtered = filtered.filter(asset => asset.region === mapSelectedRegion);
    }
    
    if (mapSelectedDistrict && mapSelectedDistrict !== "all") {
      filtered = filtered.filter(asset => asset.district === mapSelectedDistrict);
    }
    
    if (mapSelectedType && mapSelectedType !== "all") {
      filtered = filtered.filter(asset => asset.typeOfUnit === mapSelectedType);
    }
    
    if (mapSearchTerm) {
      filtered = filtered.filter(
        (asset) =>
          asset.serialNumber.toLowerCase().includes(mapSearchTerm.toLowerCase()) ||
          asset.location.toLowerCase().includes(mapSearchTerm.toLowerCase()) ||
          asset.typeOfUnit.toLowerCase().includes(mapSearchTerm.toLowerCase()) ||
          asset.region.toLowerCase().includes(mapSearchTerm.toLowerCase()) ||
          asset.district.toLowerCase().includes(mapSearchTerm.toLowerCase()) ||
          (asset.feederName && asset.feederName.toLowerCase().includes(mapSearchTerm.toLowerCase()))
      );
    }
    
    return filtered;
  }, [assets, mapSelectedRegion, mapSelectedDistrict, mapSelectedType, mapSearchTerm]);

  // Get unique asset types for filter with counts
  const assetTypes = useMemo(() => {
    const typeCounts = new Map<string, number>();
    assets.forEach(asset => {
      if (asset.typeOfUnit) {
        typeCounts.set(asset.typeOfUnit, (typeCounts.get(asset.typeOfUnit) || 0) + 1);
      }
    });
    return Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [assets]);

  // Get districts for the selected region with counts
  const availableDistricts = useMemo(() => {
    if (mapSelectedRegion === "all") {
      const districtCounts = new Map<string, number>();
      assets.forEach(asset => {
        if (asset.district) {
          districtCounts.set(asset.district, (districtCounts.get(asset.district) || 0) + 1);
        }
      });
      return districts?.map(district => ({
        ...district,
        count: districtCounts.get(district.name) || 0
      })) || [];
    }
    // Find the selected region by name to get its ID
    const selectedRegion = regions?.find(region => region.name === mapSelectedRegion);
    if (!selectedRegion) {
      return districts || [];
    }
    // Filter districts that belong to the selected region using regionId
    const regionDistricts = districts?.filter(district => district.regionId === selectedRegion.id) || [];
    
    // Add counts for districts in the selected region
    const districtCounts = new Map<string, number>();
    assets.forEach(asset => {
      if (asset.region === mapSelectedRegion && asset.district) {
        districtCounts.set(asset.district, (districtCounts.get(asset.district) || 0) + 1);
      }
    });
    
    return regionDistricts.map(district => ({
      ...district,
      count: districtCounts.get(district.name) || 0
    }));
  }, [districts, regions, mapSelectedRegion, assets]);

  // Get regions with counts
  const regionsWithCounts = useMemo(() => {
    const regionCounts = new Map<string, number>();
    assets.forEach(asset => {
      if (asset.region) {
        regionCounts.set(asset.region, (regionCounts.get(asset.region) || 0) + 1);
      }
    });
    return regions?.map(region => ({
      ...region,
      count: regionCounts.get(region.name) || 0
    })) || [];
  }, [regions, assets]);

  // Clear all map filters
  const clearMapFilters = () => {
    setMapSelectedRegion("all");
    setMapSelectedDistrict("all");
    setMapSelectedType("all");
    setMapSearchTerm("");
  };

  // Reset district when region changes
  useEffect(() => {
    if (mapSelectedRegion === "all") {
      setMapSelectedDistrict("all");
    } else {
      // Check if current district belongs to new region
      const currentDistrictExists = availableDistricts.some(district => district.name === mapSelectedDistrict);
      if (!currentDistrictExists) {
        setMapSelectedDistrict("all");
      }
    }
  }, [mapSelectedRegion, availableDistricts, mapSelectedDistrict]);

  // Calculate map bounds based on filtered assets
  const mapBounds = useMemo(() => {
    if (filteredAssets.length === 0 || !isLoaded || typeof google === 'undefined') return null;
    
    const bounds = new google.maps.LatLngBounds();
    let hasValidCoordinates = false;
    
    filteredAssets.forEach(asset => {
      if (asset.gpsCoordinates) {
        try {
          const [lat, lng] = asset.gpsCoordinates.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            bounds.extend({ lat, lng });
            hasValidCoordinates = true;
          }
        } catch (error) {
          console.error('Error parsing coordinates for asset:', asset.id, error);
        }
      }
    });
    
    return hasValidCoordinates ? bounds : null;
  }, [filteredAssets, isLoaded]);

  // Create markers for filtered assets
  const createMarkers = useCallback((map: google.maps.Map) => {
    if (!isLoaded || typeof google === 'undefined') return;
    
    // Clear existing markers
    markersRef.current.forEach(({ marker, infoWindow }) => {
      marker.map = null;
      infoWindow.close();
    });
    
    const newMarkers: MapMarker[] = [];
    
    filteredAssets.forEach(asset => {
      if (asset.gpsCoordinates) {
        try {
          const [lat, lng] = asset.gpsCoordinates.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            const position = { lat, lng };
            
            // Create pin element with safe innerHTML
            const pinElement = document.createElement('div');
            pinElement.style.cssText = 'width: 24px; height: 24px; cursor: pointer;';
            
            // Determine marker color based on asset type
            let markerColor = '#000000'; // Default black for other types
            if (asset.typeOfUnit && asset.typeOfUnit.toLowerCase().includes('recloser')) {
              markerColor = '#EF4444'; // Red for recloser
            } else if (asset.typeOfUnit && asset.typeOfUnit.toLowerCase().includes('lbs')) {
              markerColor = '#3B82F6'; // Blue for LBS
            }
            
            // Sanitize the SVG content before setting innerHTML
            const svgContent = `
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${markerColor}"/>
                <circle cx="12" cy="9" r="2.5" fill="white"/>
              </svg>
            `;
            pinElement.innerHTML = DOMPurify.sanitize(svgContent);

            // Create marker
            const marker = new google.maps.marker.AdvancedMarkerElement({
              map,
              position,
              title: asset.serialNumber,
              content: pinElement
            });

            // Create info window content using safe DOM manipulation
            const infoContent = document.createElement('div');
            infoContent.style.cssText = 'padding: 12px; max-width: 300px; font-family: system-ui, -apple-system, sans-serif;';
            
            // Create content safely using DOM methods instead of innerHTML
            const createSafeInfoContent = (asset: VITAsset) => {
              const container = document.createElement('div');
              
              // Title
              const title = document.createElement('h3');
              title.style.cssText = 'font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #1f2937;';
              title.textContent = asset.serialNumber || 'Unknown';
              container.appendChild(title);
              
              // Type
              const typeP = document.createElement('p');
              typeP.style.cssText = 'font-size: 12px; color: #6b7280; margin-bottom: 4px;';
              typeP.innerHTML = DOMPurify.sanitize(`<strong>Type:</strong> ${asset.typeOfUnit || 'Not specified'}`);
              container.appendChild(typeP);
              
              // Region
              const regionP = document.createElement('p');
              regionP.style.cssText = 'font-size: 12px; color: #6b7280; margin-bottom: 4px;';
              regionP.innerHTML = DOMPurify.sanitize(`<strong>Region:</strong> ${asset.region || 'Not specified'}`);
              container.appendChild(regionP);
              
              // District
              const districtP = document.createElement('p');
              districtP.style.cssText = 'font-size: 12px; color: #6b7280; margin-bottom: 4px;';
              districtP.innerHTML = DOMPurify.sanitize(`<strong>District:</strong> ${asset.district || 'Not specified'}`);
              container.appendChild(districtP);
              
              // Feeder
              const feederP = document.createElement('p');
              feederP.style.cssText = 'font-size: 12px; color: #6b7280; margin-bottom: 4px;';
              feederP.innerHTML = DOMPurify.sanitize(`<strong>Feeder:</strong> ${asset.feederName || 'Not specified'}`);
              container.appendChild(feederP);
              
              // GPS
              const gpsP = document.createElement('p');
              gpsP.style.cssText = 'font-size: 12px; color: #6b7280; margin-bottom: 4px;';
              gpsP.innerHTML = DOMPurify.sanitize(`<strong>GPS:</strong> ${asset.gpsCoordinates || 'Not available'}`);
              container.appendChild(gpsP);
              
              // Location
              const locationP = document.createElement('p');
              locationP.style.cssText = 'font-size: 12px; color: #6b7280; margin-bottom: 4px;';
              locationP.innerHTML = DOMPurify.sanitize(`<strong>Location:</strong> ${asset.location || 'Not specified'}`);
              container.appendChild(locationP);
              
              // Status
              const statusP = document.createElement('p');
              statusP.style.cssText = 'font-size: 12px; color: #6b7280; margin-bottom: 4px;';
              statusP.innerHTML = DOMPurify.sanitize(`<strong>Status:</strong> ${asset.status || 'Not specified'}`);
              container.appendChild(statusP);
              
              // Buttons container
              const buttonContainer = document.createElement('div');
              buttonContainer.style.cssText = 'display: flex; gap: 8px;';
              
              // Navigate button
              const navigateBtn = document.createElement('button');
              navigateBtn.id = `navigate-${asset.id}`;
              navigateBtn.style.cssText = 'font-size: 12px; background-color: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer;';
              navigateBtn.textContent = 'Navigate';
              buttonContainer.appendChild(navigateBtn);
              
              // Details button
              const detailsBtn = document.createElement('button');
              detailsBtn.id = `details-${asset.id}`;
              detailsBtn.style.cssText = 'font-size: 12px; background-color: #10b981; color: white; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer;';
              detailsBtn.textContent = 'View Details';
              buttonContainer.appendChild(detailsBtn);
              
              container.appendChild(buttonContainer);
              return container;
            };
            
            infoContent.appendChild(createSafeInfoContent(asset));

            // Create info window
            const infoWindow = new google.maps.InfoWindow({
              content: infoContent
            });

            // Add event listeners to buttons after info window is created
            infoWindow.addListener('domready', () => {
              const navigateBtn = document.getElementById(`navigate-${asset.id}`);
              const detailsBtn = document.getElementById(`details-${asset.id}`);
              
              if (navigateBtn) {
                navigateBtn.addEventListener('click', () => {
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                });
              }
              
              if (detailsBtn) {
                detailsBtn.addEventListener('click', () => {
                  handleAssetClick(asset);
                });
              }
            });

            // Add click listeners to marker
            marker.addListener('click', () => {
              infoWindow.open(map, marker);
              setSelectedAsset(asset);
            });

            newMarkers.push({ asset, marker, infoWindow });
          }
        } catch (error) {
          console.error('Error creating marker for asset:', asset.id, error);
        }
      }
    });
    
    markersRef.current = newMarkers;
    setMarkers(newMarkers);
  }, [filteredAssets, handleAssetClick, isLoaded]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    if (!isLoaded || typeof google === 'undefined') return;
    
    mapRef.current = map;
    createMarkers(map);
  }, [createMarkers, isLoaded]);

  const onMapUnmount = useCallback(() => {
    markersRef.current.forEach(({ marker, infoWindow }) => {
      marker.map = null;
      infoWindow.close();
    });
    markersRef.current = [];
    mapRef.current = null;
  }, []);

  // Update markers when filtered assets change
  useEffect(() => {
    if (mapRef.current && isLoaded) {
      createMarkers(mapRef.current);
      
      // Fit bounds if available
      if (mapBounds) {
        mapRef.current.fitBounds(mapBounds);
      }
    }
  }, [createMarkers, mapBounds, isLoaded]);

  const mapOptions = useMemo(() => ({
    mapId: 'f341f573cd154830316da927',
    mapTypeControl: true,
    streetViewControl: true,
    fullscreenControl: true,
    zoomControl: true,
    gestureHandling: 'greedy'
  }), []);

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Switchgear Assets Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground p-4 border border-destructive rounded-md">
            Error loading maps: {loadError.message}
            <br />
            Please check your internet connection and ensure the Google Maps API key is valid.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Switchgear Assets Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading maps...</div>
        </CardContent>
      </Card>
    );
  }

  const assetsWithCoordinates = filteredAssets.filter(asset => {
    if (!asset.gpsCoordinates) return false;
    try {
      const [lat, lng] = asset.gpsCoordinates.split(',').map(Number);
      return !isNaN(lat) && !isNaN(lng);
    } catch {
      return false;
    }
  });

  const totalAssetsWithCoordinates = assets.filter(asset => {
    if (!asset.gpsCoordinates) return false;
    try {
      const [lat, lng] = asset.gpsCoordinates.split(',').map(Number);
      return !isNaN(lat) && !isNaN(lng);
    } catch {
      return false;
    }
  }).length;

  return (
    <Card>
              <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Switchgear Assets Map
            <Badge variant="secondary" className="ml-2">
            {assetsWithCoordinates.length} assets
            {(mapSearchTerm || mapSelectedRegion !== "all" || mapSelectedDistrict !== "all" || mapSelectedType !== "all") && 
              totalAssetsWithCoordinates !== assetsWithCoordinates.length && (
              <span className="ml-1 text-xs opacity-75">
                of {totalAssetsWithCoordinates}
              </span>
            )}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {assetsWithCoordinates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No switchgear assets with valid coordinates found.</p>
            {filteredAssets.length > 0 && (
              <p className="text-sm mt-2">
                {filteredAssets.length} assets found but none have GPS coordinates.
              </p>
            )}
          </div>
        ) : (
          <div className="relative h-[600px] w-full rounded-md overflow-hidden border border-border">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={defaultCenter}
              zoom={10}
              onLoad={onMapLoad}
              onUnmount={onMapUnmount}
              options={mapOptions}
            />
            
            {/* Filter Controls Overlay */}
            <div className="absolute bottom-20 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200 max-w-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">Map Filters</h4>
                  <div className="flex items-center gap-1">
                    {(mapSearchTerm || mapSelectedRegion !== "all" || mapSelectedDistrict !== "all" || mapSelectedType !== "all") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearMapFilters}
                        className="h-6 px-2 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsFilterPanelExpanded(!isFilterPanelExpanded)}
                      className="h-6 px-2 text-xs"
                    >
                      {isFilterPanelExpanded ? (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      ) : (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </Button>
                  </div>
                </div>
                
                {isFilterPanelExpanded && (
                  <>
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search assets..."
                        value={mapSearchTerm}
                        onChange={(e) => setMapSearchTerm(e.target.value)}
                        className="pl-9 h-8 text-xs"
                      />
                    </div>
                    
                    {/* Region Filter */}
                    <Select value={mapSelectedRegion} onValueChange={setMapSelectedRegion}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Regions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Regions ({assets.length})</SelectItem>
                        {regionsWithCounts.map((region) => (
                          <SelectItem key={region.id} value={region.name}>
                            {region.name} ({region.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* District Filter */}
                    <Select value={mapSelectedDistrict} onValueChange={setMapSelectedDistrict}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Districts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Districts ({availableDistricts.reduce((sum, d) => sum + d.count, 0)})</SelectItem>
                        {availableDistricts.map((district) => (
                          <SelectItem key={district.id} value={district.name}>
                            {district.name} ({district.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Type Filter */}
                    <Select value={mapSelectedType} onValueChange={setMapSelectedType}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types ({assets.length})</SelectItem>
                        {assetTypes.map((type) => (
                          <SelectItem key={type.type} value={type.type}>
                            {type.type} ({type.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Filter Summary */}
                    {(mapSearchTerm || mapSelectedRegion !== "all" || mapSelectedDistrict !== "all" || mapSelectedType !== "all") && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-xs text-muted-foreground">Active:</span>
                        {mapSearchTerm && (
                          <Badge variant="secondary" className="text-xs">
                            Search: "{mapSearchTerm}"
                          </Badge>
                        )}
                        {mapSelectedRegion !== "all" && (
                          <Badge variant="secondary" className="text-xs">
                            {mapSelectedRegion}
                          </Badge>
                        )}
                        {mapSelectedDistrict !== "all" && (
                          <Badge variant="secondary" className="text-xs">
                            {mapSelectedDistrict}
                          </Badge>
                        )}
                        {mapSelectedType !== "all" && (
                          <Badge variant="secondary" className="text-xs">
                            {mapSelectedType}
                          </Badge>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            
            {/* Map controls overlay */}
            <div className="absolute bottom-4 left-4 z-10">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (mapBounds && mapRef.current && isLoaded) {
                    mapRef.current.fitBounds(mapBounds);
                  }
                }}
                className="bg-white/90 backdrop-blur-sm hover:bg-white"
              >
                <Filter className="h-4 w-4 mr-1" />
                Fit All
              </Button>
            </div>
            
            {/* Selected asset info */}
            {selectedAsset && (
              <div className="absolute bottom-4 left-4 z-10 max-w-sm">
                <Card className="bg-white/95 backdrop-blur-sm">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{selectedAsset.serialNumber}</h4>
                        <p className="text-xs text-muted-foreground">{selectedAsset.location}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {selectedAsset.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {selectedAsset.typeOfUnit}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (selectedAsset.gpsCoordinates && isLoaded) {
                            const [lat, lng] = selectedAsset.gpsCoordinates.split(',').map(Number);
                            const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                            window.open(url, '_blank');
                          }
                        }}
                        className="ml-2"
                      >
                        <Navigation className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 