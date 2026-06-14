import json
from pathlib import Path


SOURCE = Path(__file__).resolve().parents[2] / "assets" / "geo" / "BR_UF_2023.geojson"
TARGET = Path(__file__).resolve().parents[1] / "public" / "geo" / "BR_UF_2023_simplified.geojson"
TOLERANCE = 0.015


def perpendicular_distance(point, start, end):
    x, y = point[:2]
    x1, y1 = start[:2]
    x2, y2 = end[:2]
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / ((dx * dx + dy * dy) ** 0.5)


def douglas_peucker(points, tolerance):
    if len(points) <= 2:
        return points

    max_distance = 0
    index = 0
    start = points[0]
    end = points[-1]

    for current_index in range(1, len(points) - 1):
        distance = perpendicular_distance(points[current_index], start, end)
        if distance > max_distance:
            index = current_index
            max_distance = distance

    if max_distance > tolerance:
        left = douglas_peucker(points[: index + 1], tolerance)
        right = douglas_peucker(points[index:], tolerance)
        return left[:-1] + right

    return [start, end]


def round_point(point):
    return [round(point[0], 4), round(point[1], 4)]


def simplify_ring(ring):
    if len(ring) <= 4:
        return [round_point(point) for point in ring]

    closed = ring[0] == ring[-1]
    points = ring[:-1] if closed else ring
    simplified = douglas_peucker(points, TOLERANCE)

    if len(simplified) < 3:
        simplified = points[:3]

    simplified = [round_point(point) for point in simplified]
    if closed and simplified[0] != simplified[-1]:
        simplified.append(simplified[0])
    return simplified


def simplify_polygon(polygon):
    return [simplify_ring(ring) for ring in polygon if len(ring) >= 4]


def simplify_geometry(geometry):
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates", [])

    if geometry_type == "Polygon":
        return {"type": "Polygon", "coordinates": simplify_polygon(coordinates)}

    if geometry_type == "MultiPolygon":
        return {"type": "MultiPolygon", "coordinates": [simplify_polygon(polygon) for polygon in coordinates]}

    return geometry


def main():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    output = {
        "type": "FeatureCollection",
        "features": [],
    }

    for feature in data["features"]:
        output["features"].append(
            {
                "type": "Feature",
                "properties": {
                    "NM_UF": feature["properties"]["NM_UF"],
                    "SIGLA_UF": feature["properties"]["SIGLA_UF"],
                },
                "geometry": simplify_geometry(feature["geometry"]),
            }
        )

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {TARGET} ({TARGET.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
