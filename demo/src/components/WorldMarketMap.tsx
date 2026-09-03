import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSONSource, Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import type { CustomerSummary, Inquiry } from "../api";
import { readTheme, subscribeTheme, type WorkbenchTheme } from "../theme";
import "maplibre-gl/dist/maplibre-gl.css";
import "./WorldMarketMap.css";

const HQ: [number, number] = [123.17, 41.27];

const ALIAS: Record<string, string> = {
  uae: "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  阿联酋: "United Arab Emirates",
  kenya: "Kenya",
  肯尼亚: "Kenya",
  chile: "Chile",
  智利: "Chile",
  nigeria: "Nigeria",
  尼日利亚: "Nigeria",
  china: "China",
  中国: "China",
  brazil: "Brazil",
  巴西: "Brazil",
  germany: "Germany",
  德国: "Germany",
  "saudi arabia": "Saudi Arabia",
  沙特: "Saudi Arabia",
  沙特阿拉伯: "Saudi Arabia",
  india: "India",
  印度: "India",
  "south africa": "South Africa",
  南非: "South Africa",
  mexico: "Mexico",
  墨西哥: "Mexico",
  russia: "Russia",
  俄罗斯: "Russia",
  indonesia: "Indonesia",
  印尼: "Indonesia",
  印度尼西亚: "Indonesia",
  vietnam: "Vietnam",
  越南: "Vietnam",
  egypt: "Egypt",
  埃及: "Egypt",
  turkey: "Turkey",
  土耳其: "Turkey",
  australia: "Australia",
  澳大利亚: "Australia",
  "united states": "United States",
  usa: "United States",
  美国: "United States",
  uk: "United Kingdom",
  "united kingdom": "United Kingdom",
  英国: "United Kingdom",
};

const LABEL_ZH: Record<string, string> = {
  "United Arab Emirates": "阿联酋",
  Kenya: "肯尼亚",
  Chile: "智利",
  Nigeria: "尼日利亚",
  China: "中国",
  Brazil: "巴西",
  Germany: "德国",
  "Saudi Arabia": "沙特",
  India: "印度",
  "South Africa": "南非",
  Mexico: "墨西哥",
  Russia: "俄罗斯",
  Indonesia: "印尼",
  Vietnam: "越南",
  Egypt: "埃及",
  Turkey: "土耳其",
  Australia: "澳大利亚",
  "United States": "美国",
  "United Kingdom": "英国",
};

const COORDS: Record<string, [number, number]> = {
  China: [104.2, 35.6],
  "United Arab Emirates": [54.37, 24.45],
  Kenya: [37.91, -1.29],
  Chile: [-70.67, -33.45],
  Nigeria: [7.49, 9.08],
  Brazil: [-47.93, -15.78],
  Germany: [13.4, 52.52],
  "Saudi Arabia": [46.74, 24.69],
  India: [77.21, 28.61],
  "South Africa": [28.22, -25.75],
  "United States": [-95.71, 37.09],
  "United Kingdom": [-0.13, 51.51],
  Mexico: [-99.13, 19.43],
  Russia: [37.62, 55.75],
  Indonesia: [106.85, -6.2],
  Vietnam: [105.85, 21.03],
  Egypt: [31.24, 30.04],
  Turkey: [32.86, 39.93],
  Australia: [149.13, -35.28],
};

type GeoFeature = {
  properties?: { name?: string };
  geometry?: { type: string; coordinates: unknown };
};

type MarketMarker = {
  key: string;
  name: string;
  label: string;
  lon: number;
  lat: number;
  deals: number;
  aClients: number;
  kind: "a" | "deal";
};

function normalizeCountry(raw: string | null | undefined) {
  const text = raw?.trim();
  if (!text) return "";
  return ALIAS[text.toLowerCase()] || ALIAS[text] || text;
}

function displayName(name: string) {
  return LABEL_ZH[name] || name;
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function toDeg(value: number) {
  return (value * 180) / Math.PI;
}

function pointAlong(coords: [number, number][], t: number): [number, number] {
  if (coords.length < 2) return coords[0] || HQ;
  const scaled = (((t % 1) + 1) % 1) * (coords.length - 1);
  const index = Math.floor(scaled);
  const next = Math.min(index + 1, coords.length - 1);
  const mix = scaled - index;
  return [
    coords[index][0] + (coords[next][0] - coords[index][0]) * mix,
    coords[index][1] + (coords[next][1] - coords[index][1]) * mix,
  ];
}

function greatCircle(start: [number, number], end: [number, number], steps = 64): [number, number][] {
  const lat1 = toRad(start[1]);
  const lon1 = toRad(start[0]);
  const lat2 = toRad(end[1]);
  const lon2 = toRad(end[0]);
  const delta = 2 * Math.asin(
    Math.sqrt(
      Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
    ),
  );
  if (!delta) return [start, end];
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const fraction = i / steps;
    const a = Math.sin((1 - fraction) * delta) / Math.sin(delta);
    const b = Math.sin(fraction * delta) / Math.sin(delta);
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);
    coords.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return coords;
}

function centroidOf(geometry: GeoFeature["geometry"]): [number, number] | null {
  let best: number[][] = [];
  if (geometry?.type === "Polygon") {
    best = ((geometry.coordinates as number[][][])[0] || []) as number[][];
  } else if (geometry?.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates as number[][][][]) {
      const outer = polygon[0] || [];
      if (outer.length > best.length) best = outer;
    }
  }
  if (best.length < 2) return null;
  let lon = 0;
  let lat = 0;
  for (const point of best) {
    lon += point[0];
    lat += point[1];
  }
  return [lon / best.length, lat / best.length];
}

function beforeLabelLayerId(map: MapLibreMap) {
  return map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
}

function applyMapPaint(map: MapLibreMap, theme: WorkbenchTheme) {
  const dark = theme === "dark";
  const style = map.getStyle();
  if (!style?.layers) return;
  if (dark) {
    for (const layer of style.layers) {
      const id = layer.id.toLowerCase();
      try {
        if (layer.type === "background") {
          map.setPaintProperty(layer.id, "background-color", "#0a0f16");
        } else if (layer.type === "fill") {
          if (id.includes("water")) map.setPaintProperty(layer.id, "fill-color", "#05090f");
          else if (id.includes("building")) {
            map.setPaintProperty(layer.id, "fill-color", "#10171f");
            map.setPaintProperty(layer.id, "fill-opacity", 0.6);
          } else if (id.includes("landcover") || id.includes("landuse") || id.includes("park") || id.includes("wood")) {
            map.setPaintProperty(layer.id, "fill-color", "#0c121b");
            map.setPaintProperty(layer.id, "fill-opacity", 0.5);
          } else if (id.includes("land")) map.setPaintProperty(layer.id, "fill-color", "#0a0f16");
        } else if (layer.type === "line") {
          if (id.includes("water")) map.setPaintProperty(layer.id, "line-color", "#05090f");
          else if (id.includes("boundary") || id.includes("admin")) {
            map.setPaintProperty(layer.id, "line-color", "#243244");
            map.setPaintProperty(layer.id, "line-opacity", 0.65);
          } else if (id.includes("motorway") || id.includes("trunk") || id.includes("primary")) {
            map.setPaintProperty(layer.id, "line-color", "#26303c");
          } else if (id.includes("road") || id.includes("street") || id.includes("transport") || id.includes("bridge")) {
            map.setPaintProperty(layer.id, "line-color", "#1a2129");
          }
        } else if (layer.type === "symbol" && map.getLayoutProperty(layer.id, "text-field")) {
          map.setPaintProperty(layer.id, "text-color", id.includes("country") || id.includes("city") ? "#c7d2e0" : "#7d8bb9");
          map.setPaintProperty(layer.id, "text-halo-color", "#02040a");
          map.setPaintProperty(layer.id, "text-halo-width", 1.2);
        }
      } catch {
        /* style variant without this paint property */
      }
    }
  } else {
    for (const layer of style.layers) {
      const id = layer.id.toLowerCase();
      try {
        if (layer.type === "background") {
          map.setPaintProperty(layer.id, "background-color", "#d4e8f8");
        } else if (layer.type === "fill" && id.includes("water")) {
          map.setPaintProperty(layer.id, "fill-color", "#7eb6de");
        }
      } catch {
        /* style variant without this paint property */
      }
    }
  }
  const withFog = map as MapLibreMap & { setFog?: (fog: Record<string, unknown>) => void };
  try {
    withFog.setFog?.(
      dark
        ? {
            color: "rgba(8, 14, 22, 0.9)",
            "high-color": "rgba(12, 28, 48, 1)",
            "horizon-blend": 0.04,
            "space-color": "#02030a",
            "star-intensity": 0.45,
          }
        : {
            color: "rgba(180, 214, 240, 0.75)",
            "high-color": "rgba(150, 198, 232, 1)",
            "horizon-blend": 0.12,
            "space-color": "#8fb9dc",
            "star-intensity": 0,
          },
    );
  } catch {
    /* older renderer */
  }
}

function prepareGlobe(map: MapLibreMap, theme: WorkbenchTheme) {
  try {
    map.setProjection({ type: "globe" });
  } catch {
    /* mercator fallback */
  }
  applyMapPaint(map, theme);
  addMarketLayers(map, theme);
  map.dragPan.enable();
  map.scrollZoom.enable();
  map.touchZoomRotate.enable();
  map.touchZoomRotate.disableRotation();
}

const MAP_STYLE: Record<WorkbenchTheme, string> = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/liberty",
};

function addMarketLayers(map: MapLibreMap, theme: WorkbenchTheme) {
  if (map.getSource("countries")) return;
  const dark = theme === "dark";
  const beforeId = beforeLabelLayerId(map);
  map.addSource("countries", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer(
    {
      id: "country-fill",
      type: "fill",
      source: "countries",
      paint: {
        "fill-color": ["match", ["get", "role"], "a", "#c4a15a", "#6e7ea3"],
        "fill-opacity": dark ? 0.22 : 0.18,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "country-line",
      type: "line",
      source: "countries",
      paint: {
        "line-color": dark ? "#9aa8c3" : "#3d6a96",
        "line-opacity": 0.45,
        "line-width": 0.8,
      },
    },
    beforeId,
  );
  map.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer(
    {
      id: "routes-glow",
      type: "line",
      source: "routes",
      paint: {
        "line-color": dark ? "#7ef0ff" : "#0b63c7",
        "line-width": dark ? 3.2 : 4,
        "line-opacity": dark ? 0.22 : 0.28,
        "line-blur": 1.2,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "routes-line",
      type: "line",
      source: "routes",
      paint: {
        "line-color": dark ? "#9ad8ff" : "#083d7a",
        "line-width": dark ? 1.4 : 2.6,
        "line-opacity": dark ? 0.7 : 0.95,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "routes-pulse",
      type: "line",
      source: "routes",
      paint: {
        "line-color": dark ? "#e8fbff" : "#ff8a1a",
        "line-width": dark ? 1.8 : 2.2,
        "line-opacity": 0.95,
        "line-dasharray": [0.4, 5, 1.2, 18],
      },
    },
    beforeId,
  );
  map.addSource("route-dots", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: "route-dots",
    type: "circle",
    source: "route-dots",
    paint: {
      "circle-radius": 4.2,
      "circle-color": dark ? "#9ef6ff" : "#ff7a18",
      "circle-stroke-width": 1.4,
      "circle-stroke-color": dark ? "#083044" : "#ffffff",
      "circle-opacity": 0.95,
    },
  });
}

function createPin(marker: MarketMarker, onClick: (name: string) => void) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `world-pin world-pin-${marker.kind}`;
  el.innerHTML = `<strong></strong><span></span>`;
  el.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick(marker.name);
  });
  updatePin(el, marker);
  return el;
}

function updatePin(el: HTMLElement, marker: MarketMarker) {
  el.className = `world-pin world-pin-${marker.kind}`;
  const value = el.querySelector("strong");
  const label = el.querySelector("span");
  if (value) value.textContent = String(marker.deals);
  if (label) label.textContent = marker.kind === "a" ? `${marker.label} · A` : marker.label;
}

export type MarketBoardStats = {
  total: number;
  currentMonth: number;
  pending: number;
  pendingReview: number;
  sent: number;
  customers?: number;
  aLeads: number;
  bLeads: number;
  cLeads: number;
  byChannel: Array<{ name: string; count: number }>;
  recent: Array<{ id: string; company: string; country: string; status: string; time: string }>;
};

const CHANNEL_ZH: Record<string, string> = {
  manual: "手动录入",
  website_form: "独立站",
  alibaba: "阿里国际站",
};

type DonutSlice = { key: string; label: string; value: number; color: string };

function OpsDonut(props: { slices: DonutSlice[]; unit: string }) {
  const total = props.slices.reduce((sum, item) => sum + item.value, 0);
  const safe = Math.max(1, total);
  let start = 0;
  const stops = props.slices.map((item) => {
    const size = (item.value / safe) * 360;
    const from = start;
    start += size;
    return `${item.color} ${from}deg ${start}deg`;
  });
  return (
    <div className="ops-donut">
      <div
        className="ops-donut-ring"
        style={{
          background: total ? `conic-gradient(${stops.join(", ")})` : "var(--ops-track)",
        }}
      >
        <div>
          <strong>{total}</strong>
          <span>{props.unit}</span>
        </div>
      </div>
      <ul>
        {props.slices.length ? (
          props.slices.map((item) => (
            <li key={item.key}>
              <i style={{ background: item.color }} />
              <span>{item.label}</span>
              <b>{item.value}</b>
              <em>{total ? Math.round((item.value / total) * 100) : 0}%</em>
            </li>
          ))
        ) : (
          <li className="ops-empty">暂无数据</li>
        )}
      </ul>
    </div>
  );
}

export function WorldMarketMap(props: {
  inquiries: Inquiry[];
  customers: CustomerSummary[];
  stats?: MarketBoardStats;
  onCountryClick?: (query: string) => void;
  onOpenInquiry?: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const geoRef = useRef<{ features?: GeoFeature[] } | null>(null);
  const markerObjs = useRef(new Map<string, Marker>());
  const hubRef = useRef<Marker | null>(null);
  const onClickRef = useRef(props.onCountryClick);
  const fittedRef = useRef(false);
  const appliedTheme = useRef<WorkbenchTheme>(readTheme());
  const routePathsRef = useRef<[number, number][][]>([]);
  const [theme, setThemeState] = useState<WorkbenchTheme>(() => readTheme());
  const [ready, setReady] = useState(false);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [centers, setCenters] = useState<Record<string, [number, number]>>({});

  onClickRef.current = props.onCountryClick;

  useEffect(() => subscribeTheme(() => setThemeState(readTheme())), []);

  useEffect(() => {
    Object.values(MAP_STYLE).forEach((url) => {
      fetch(url).catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/world.json")
      .then((res) => res.json())
      .then((geo: { features?: GeoFeature[] }) => {
        if (cancelled) return;
        geoRef.current = geo;
        const next: Record<string, [number, number]> = { ...COORDS };
        for (const feature of geo.features || []) {
          const name = feature.properties?.name;
          if (!name || next[name]) continue;
          const center = centroidOf(feature.geometry);
          if (center) next[name] = center;
        }
        setCenters(next);
      })
      .catch(() => setCenters(COORDS));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: canvasRef.current,
      style: MAP_STYLE[appliedTheme.current],
      center: [20, 8],
      zoom: 3.35,
      minZoom: 0.85,
      maxZoom: 12,
      fadeDuration: 0,
      dragPan: true,
      scrollZoom: true,
      dragRotate: false,
      pitch: 0,
      cooperativeGestures: false,
      attributionControl: false,
    });
    map.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
    map.on("styleimagemissing", (event) => {
      if (!map.hasImage(event.id)) {
        map.addImage(event.id, { width: 1, height: 1, data: new Uint8Array(4) });
      }
    });
    let started = false;
    const onReady = () => {
      if (started) return;
      started = true;
      try {
        prepareGlobe(map, appliedTheme.current);
      } catch {
        /* keep the basemap even if overlays fail */
      }
      setReady(true);
      window.setTimeout(() => map.resize(), 80);
      window.setTimeout(() => map.resize(), 400);
    };
    map.once("style.load", onReady);
    mapRef.current = map;
    if (map.isStyleLoaded()) onReady();
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(canvasRef.current);
    const markerStore = markerObjs.current;
    return () => {
      observer.disconnect();
      markerStore.forEach((item) => item.remove());
      markerStore.clear();
      const hub = hubRef.current;
      hub?.remove();
      hubRef.current = null;
      fittedRef.current = false;
      setReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedTheme.current === theme) return;
    appliedTheme.current = theme;
    setReady(false);
    map.setStyle(MAP_STYLE[theme]);
    map.once("style.load", () => {
      try {
        prepareGlobe(map, theme);
      } catch {
        /* keep the basemap even if overlays fail */
      }
      setStyleEpoch((value) => value + 1);
      setReady(true);
      window.setTimeout(() => map.resize(), 80);
    });
  }, [theme]);

  const baseMarkers = useMemo(() => {
    const deals = new Map<string, number>();
    const aClients = new Map<string, number>();
    const seenA = new Set<string>();

    for (const inquiry of props.inquiries) {
      const name = normalizeCountry(inquiry.buyerCountry);
      if (!name) continue;
      deals.set(name, (deals.get(name) || 0) + 1);
      if (inquiry.leadGrade === "A") {
        const key = inquiry.customer?.id || inquiry.buyerEmail || inquiry.buyerCompany || inquiry.id;
        if (!seenA.has(`${name}:${key}`)) {
          seenA.add(`${name}:${key}`);
          aClients.set(name, (aClients.get(name) || 0) + 1);
        }
      }
    }
    for (const customer of props.customers) {
      const name = normalizeCountry(customer.country);
      if (!name) continue;
      if (customer.leadGrade === "A") aClients.set(name, (aClients.get(name) || 0) + 1);
    }

    const names = new Set([...deals.keys(), ...aClients.keys()]);
    const markers: MarketMarker[] = [];
    for (const name of names) {
      const point = centers[name];
      if (!point) continue;
      const a = aClients.get(name) || 0;
      markers.push({
        key: name,
        name,
        label: displayName(name),
        lon: point[0],
        lat: point[1],
        deals: deals.get(name) || 0,
        aClients: a,
        kind: a > 0 ? "a" : "deal",
      });
    }
    return markers;
  }, [props.inquiries, props.customers, centers]);

  const markers = baseMarkers;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const openCountry = (name: string) => {
      if (!onClickRef.current) return;
      const fromInquiry = props.inquiries.find((item) => normalizeCountry(item.buyerCountry) === name)?.buyerCountry;
      const fromCustomer = props.customers.find((item) => normalizeCountry(item.country) === name)?.country;
      onClickRef.current(fromInquiry || fromCustomer || name);
    };

    const geo = geoRef.current;
    const highlightNames = new Set(markers.map((item) => item.key));
    const features = (geo?.features || [])
      .filter((feature) => highlightNames.has(feature.properties?.name || ""))
      .map((feature) => ({
        type: "Feature" as const,
        properties: {
          name: feature.properties?.name,
          role: markers.find((item) => item.key === feature.properties?.name)?.kind || "deal",
        },
        geometry: feature.geometry,
      }));
    const countrySource = map.getSource("countries") as GeoJSONSource | undefined;
    countrySource?.setData({ type: "FeatureCollection", features });

    const routeFeatures = markers.map((marker) => {
      const coordinates = greatCircle(HQ, [marker.lon, marker.lat]);
      return {
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates },
        properties: {},
      };
    });
    routePathsRef.current = routeFeatures.map((item) => item.geometry.coordinates);
    const routeSource = map.getSource("routes") as GeoJSONSource | undefined;
    routeSource?.setData({ type: "FeatureCollection", features: routeFeatures });

    const seen = new Set<string>();
    for (const marker of markers) {
      seen.add(marker.key);
      const existing = markerObjs.current.get(marker.key);
      if (existing) {
        existing.setLngLat([marker.lon, marker.lat]);
        updatePin(existing.getElement(), marker);
        continue;
      }
      const pin = new Marker({ element: createPin(marker, openCountry), anchor: "bottom", opacityWhenCovered: 0 })
        .setLngLat([marker.lon, marker.lat])
        .addTo(map);
      markerObjs.current.set(marker.key, pin);
    }
    for (const [key, marker] of markerObjs.current) {
      if (seen.has(key)) continue;
      marker.remove();
      markerObjs.current.delete(key);
    }
    if (!hubRef.current) {
      const hub = document.createElement("div");
      hub.className = "world-hub";
      hubRef.current = new Marker({ element: hub, anchor: "center", opacityWhenCovered: 0 }).setLngLat(HQ).addTo(map);
    } else {
      hubRef.current.setLngLat(HQ);
    }

    if (!fittedRef.current && markers.length) {
      fittedRef.current = true;
      map.easeTo({ center: [20, 8], zoom: 3.35, duration: 700 });
    }
  }, [markers, ready, styleEpoch, props.inquiries, props.customers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let held = false;
    let resumeAt = 0;
    const pause = () => {
      held = true;
      resumeAt = Number.POSITIVE_INFINITY;
    };
    const resume = () => {
      held = false;
      resumeAt = performance.now() + 5000;
    };
    const tick = (now: number) => {
      if (!held && now >= resumeAt) {
        const center = map.getCenter();
        map.jumpTo({ center: [center.lng + 0.11, center.lat] });
      }
      const paths = routePathsRef.current;
      if (paths.length && map.getSource("route-dots")) {
        const progress = (now / 2600) % 1;
        (map.getSource("route-dots") as GeoJSONSource).setData({
          type: "FeatureCollection",
          features: paths.map((coords, index) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: pointAlong(coords, progress + index * 0.18) },
            properties: {},
          })),
        });
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    map.on("mousedown", pause);
    map.on("mouseup", resume);
    map.on("wheel", resume);
    map.on("touchstart", pause);
    map.on("touchend", resume);
    map.on("dragstart", pause);
    map.on("dragend", resume);
    return () => {
      window.cancelAnimationFrame(frame);
      map.off("mousedown", pause);
      map.off("mouseup", resume);
      map.off("wheel", resume);
      map.off("touchstart", pause);
      map.off("touchend", resume);
      map.off("dragstart", pause);
      map.off("dragend", resume);
    };
  }, [ready]);

  const aCount = markers.filter((item) => item.kind === "a").length;
  const dealSum = markers.reduce((sum, item) => sum + item.deals, 0);
  const stats = props.stats;
  const channelSlices = (stats?.byChannel || []).map((item, index) => ({
    key: item.name,
    label: CHANNEL_ZH[item.name] || item.name,
    value: item.count,
    color: ["#4cc3ff", "#9be15d", "#f0c35a", "#c084fc"][index % 4],
  }));

  return (
    <div className="world-ops">
      <header className="world-ops-head">
        <h1>易发式电气外贸 Agent</h1>
      </header>
      <div className="world-ops-grid">
        <aside className="world-ops-col">
          <section className="ops-pane">
            <h2>本月询盘</h2>
            <p className="ops-metric cyan">
              {stats?.currentMonth ?? dealSum}
              <em>笔</em>
            </p>
            <small>累计 {stats?.total ?? dealSum} 笔</small>
          </section>
          <section className="ops-pane ops-split">
            <div>
              <h2>待处理</h2>
              <p className="ops-metric lime">
                {stats?.pending ?? 0}
                <em>笔</em>
              </p>
              <small>待审核 {stats?.pendingReview ?? 0}</small>
            </div>
            <div>
              <h2>已发送</h2>
              <p className="ops-metric gold">
                {stats?.sent ?? 0}
                <em>笔</em>
              </p>
              <small>已完成回复</small>
            </div>
          </section>
          <section className="ops-pane ops-chart">
            <h2>客户等级</h2>
            <OpsDonut
              unit="客户"
              slices={[
                { key: "A", label: "A 级", value: stats?.aLeads ?? aCount, color: "#f0c35a" },
                { key: "B", label: "B 级", value: stats?.bLeads ?? 0, color: "#4cc3ff" },
                { key: "C", label: "C 级", value: stats?.cLeads ?? 0, color: "#7dffb3" },
              ]}
            />
          </section>
        </aside>
        <div className="world-ops-main">
          <div className="world-market-stage" aria-label="全球询盘与 A 级客户动态地图">
            <div ref={canvasRef} className="world-market-canvas" />
            <div className="world-market-legend">
              <b>图例</b>
              <span>
                <i className="dot a" />
                A 级客户
              </span>
              <span>
                <i className="dot deal" />
                询盘
              </span>
            </div>
          </div>
        </div>
        <aside className="world-ops-col">
          <section className="ops-pane">
            <h2>覆盖国家</h2>
            <p className="ops-metric cyan">
              {markers.length}
              <em>个</em>
            </p>
            <small>客户 {stats?.customers ?? props.customers.length} 个</small>
          </section>
          <section className="ops-pane ops-feed-pane">
            <h2>最新消息</h2>
            <p className="ops-metric gold">
              {stats?.pending ?? 0}
              <em>笔</em>
            </p>
            <ol className="ops-feed">
              {stats?.recent.length ? (
                stats.recent.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => props.onOpenInquiry?.(item.id)}>
                      <time>{item.time}</time>
                      <span>{item.company}</span>
                      <em>{item.status}</em>
                    </button>
                  </li>
                ))
              ) : (
                <li className="is-empty">暂无最新询盘</li>
              )}
            </ol>
          </section>
          <section className="ops-pane ops-chart">
            <h2>询盘来源</h2>
            <OpsDonut unit="来源" slices={channelSlices} />
          </section>
        </aside>
      </div>
    </div>
  );
}
