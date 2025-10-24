use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Serialize, Deserialize)]
pub struct Point {
    pub lat: f64,
    pub lng: f64,
}

#[derive(Serialize, Deserialize)]
pub struct Lane {
    pub id: String,
    #[serde(rename = "edgeId")]
    pub edge_id: Option<String>,
    pub points: Vec<Vec<f64>>,
    pub speed: Option<f64>,
    #[serde(rename = "isInternal")]
    pub is_internal: bool,
}

#[derive(Serialize, Deserialize)]
pub struct TrafficLight {
    pub id: String,
    #[serde(rename = "clusterId")]
    pub cluster_id: String,
    pub lat: f64,
    pub lng: f64,
}

#[derive(Serialize, Deserialize)]
pub struct Junction {
    pub id: String,
    #[serde(rename = "type")]
    pub junction_type: String,
    pub polygon: Vec<Vec<f64>>,
}

#[derive(Serialize, Deserialize)]
pub struct JunctionPoint {
    pub id: String,
    pub lat: f64,
    pub lng: f64,
}

#[derive(Serialize, Deserialize)]
pub struct Bounds {
    #[serde(rename = "minX")]
    pub min_x: f64,
    #[serde(rename = "minY")]
    pub min_y: f64,
    #[serde(rename = "maxX")]
    pub max_x: f64,
    #[serde(rename = "maxY")]
    pub max_y: f64,
}

#[derive(Serialize, Deserialize)]
pub struct ParsedNetwork {
    pub lanes: Vec<Lane>,
    pub bounds: Option<Bounds>,
    pub tls: Vec<TrafficLight>,
    pub junctions: Vec<Junction>,
    #[serde(rename = "junctionPoints")]
    pub junction_points: Vec<JunctionPoint>,
}

// Ramer-Douglas-Peucker algorithm for line simplification
fn rdp_simplify(points: &[(f64, f64)], epsilon: f64) -> Vec<(f64, f64)> {
    if points.len() <= 2 {
        return points.to_vec();
    }

    let epsilon_squared = epsilon * epsilon;
    let mut keep = vec![false; points.len()];
    keep[0] = true;
    keep[points.len() - 1] = true;

    let mut stack = vec![(0, points.len() - 1)];

    while let Some((start, end)) = stack.pop() {
        let mut max_dist_sq = 0.0;
        let mut max_idx = 0;

        for i in start + 1..end {
            let dist_sq = point_to_segment_distance_sq(points[i], points[start], points[end]);
            if dist_sq > max_dist_sq {
                max_dist_sq = dist_sq;
                max_idx = i;
            }
        }

        if max_dist_sq > epsilon_squared {
            keep[max_idx] = true;
            stack.push((start, max_idx));
            stack.push((max_idx, end));
        }
    }

    points.iter()
        .enumerate()
        .filter(|(i, _)| keep[*i])
        .map(|(_, p)| *p)
        .collect()
}

fn point_to_segment_distance_sq(p: (f64, f64), v: (f64, f64), w: (f64, f64)) -> f64 {
    let l2 = (v.0 - w.0).powi(2) + (v.1 - w.1).powi(2);
    if l2 == 0.0 {
        return (p.0 - v.0).powi(2) + (p.1 - v.1).powi(2);
    }

    let t = (((p.0 - v.0) * (w.0 - v.0) + (p.1 - v.1) * (w.1 - v.1)) / l2).max(0.0).min(1.0);
    let proj_x = v.0 + t * (w.0 - v.0);
    let proj_y = v.1 + t * (w.1 - v.1);

    (p.0 - proj_x).powi(2) + (p.1 - proj_y).powi(2)
}

fn sample_points(points: &[(f64, f64)], max_points: usize) -> Vec<(f64, f64)> {
    if points.len() <= max_points {
        return points.to_vec();
    }

    let step = (points.len() as f64 / max_points as f64).ceil() as usize;
    let mut result: Vec<(f64, f64)> = points.iter()
        .step_by(step)
        .copied()
        .collect();

    // Always include the last point
    if result.last() != points.last() {
        if let Some(last) = points.last() {
            result.push(*last);
        }
    }

    result
}

fn parse_point_string(shape: &str) -> Vec<(f64, f64)> {
    shape
        .split_whitespace()
        .filter_map(|pair| {
            let coords: Vec<&str> = pair.split(',').collect();
            if coords.len() == 2 {
                if let (Ok(x), Ok(y)) = (coords[0].parse::<f64>(), coords[1].parse::<f64>()) {
                    if x.is_finite() && y.is_finite() {
                        return Some((x, y));
                    }
                }
            }
            None
        })
        .collect()
}

#[wasm_bindgen]
pub fn parse_sumo_net_xml(xml_text: &str) -> Result<JsValue, JsValue> {
    console_log!("Starting WASM XML parsing...");
    
    let doc = roxmltree::Document::parse(xml_text)
        .map_err(|e| JsValue::from_str(&format!("XML parse error: {}", e)))?;

    let root = doc.root_element();
    
    // Parse bounds
    let bounds = root
        .descendants()
        .find(|n| n.tag_name().name() == "location")
        .and_then(|loc| {
            loc.attribute("convBoundary").and_then(|cb| {
                let parts: Vec<f64> = cb
                    .split(',')
                    .filter_map(|s| s.parse::<f64>().ok())
                    .collect();
                if parts.len() == 4 {
                    Some(Bounds {
                        min_x: parts[0],
                        min_y: parts[1],
                        max_x: parts[2],
                        max_y: parts[3],
                    })
                } else {
                    None
                }
            })
        });

    console_log!("Parsed bounds: {:?}", bounds.is_some());

    // Include ALL edges to match the simple JS parser's connectivity
    let all_edges: Vec<_> = root
        .descendants()
        .filter(|n| n.tag_name().name() == "edge")
        .collect();
    console_log!("Total edges found: {}", all_edges.len());

    // Geometry settings close to JS
    const SIMPLIFY_EPS: f64 = 5.0;
    const MAX_POINTS_PER_LANE: usize = 20;

    // Collect ALL internal lanes; for non-internal, keep one representative per edge
    let mut lanes: Vec<Lane> = Vec::new();
    let mut rep_by_edge: std::collections::HashMap<String, Lane> = std::collections::HashMap::new();
    let mut internal_count: usize = 0;

    for edge in all_edges {
        let edge_id_str = edge
            .attribute("id")
            .map(String::from)
            .unwrap_or_else(|| String::from(""));
        let function = edge.attribute("function").unwrap_or("");
        let is_internal_edge = function == "internal";

        for lane_node in edge.descendants().filter(|n| n.tag_name().name() == "lane") {
            let lane_id = lane_node.attribute("id").unwrap_or("");
            let shape = lane_node.attribute("shape");
            let speed = lane_node.attribute("speed").and_then(|s| s.parse::<f64>().ok());

            if let Some(shape_str) = shape {
                let mut points = parse_point_string(shape_str);
                if points.len() >= 2 {
                    if points.len() > 4 { points = rdp_simplify(&points, SIMPLIFY_EPS); }
                    if points.len() > MAX_POINTS_PER_LANE { points = sample_points(&points, MAX_POINTS_PER_LANE); }

                    let latlngs: Vec<Vec<f64>> = points.iter().map(|(x, y)| vec![*y, *x]).collect();
                    if latlngs.len() >= 2 {
                        let lane = Lane {
                            id: lane_id.to_string(),
                            edge_id: Some(edge_id_str.clone()),
                            points: latlngs,
                            speed,
                            is_internal: is_internal_edge,
                        };
                        if is_internal_edge {
                            lanes.push(lane);
                            internal_count += 1;
                        } else {
                            // Keep the lane with most points as representative for the edge
                            let keep = match rep_by_edge.get(&edge_id_str) {
                                Some(existing) => lane.points.len() > existing.points.len(),
                                None => true,
                            };
                            if keep {
                                rep_by_edge.insert(edge_id_str.clone(), lane);
                            }
                        }
                    }
                }
            }
        }
    }

    // Append representative non-internal lanes
    lanes.extend(rep_by_edge.into_values());

    console_log!("Output lanes: {} (internals: {})", lanes.len(), internal_count);

    // Parse traffic lights
    let tls: Vec<TrafficLight> = root
        .descendants()
        .filter(|n| {
            n.tag_name().name() == "junction" 
            && n.attribute("type") == Some("traffic_light")
        })
        .filter_map(|j| {
            let id = j.attribute("id")?;
            let cluster_id = j.attribute("tl").unwrap_or(id);
            let x = j.attribute("x")?.parse::<f64>().ok()?;
            let y = j.attribute("y")?.parse::<f64>().ok()?;
            
            if x.is_finite() && y.is_finite() {
                Some(TrafficLight {
                    id: id.to_string(),
                    cluster_id: cluster_id.to_string(),
                    lat: y,
                    lng: x,
                })
            } else {
                None
            }
        })
        .collect();

    console_log!("Parsed {} traffic lights", tls.len());

    // Parse junctions with polygons
    let junctions: Vec<Junction> = root
        .descendants()
        .filter(|n| n.tag_name().name() == "junction" && n.attribute("shape").is_some())
        .filter_map(|j| {
            let id = j.attribute("id")?;
            let junction_type = j.attribute("type").unwrap_or("");
            let shape_str = j.attribute("shape")?;
            
            let points = parse_point_string(shape_str);
            if points.len() >= 3 {
                let polygon: Vec<Vec<f64>> = points
                    .iter()
                    .map(|(x, y)| vec![*y, *x])
                    .collect();
                
                Some(Junction {
                    id: id.to_string(),
                    junction_type: junction_type.to_string(),
                    polygon,
                })
            } else {
                None
            }
        })
        .collect();

    console_log!("Parsed {} junctions", junctions.len());

    // Parse junction points (fallback)
    let junction_points: Vec<JunctionPoint> = root
        .descendants()
        .filter(|n| {
            n.tag_name().name() == "junction" 
            && n.attribute("x").is_some()
            && n.attribute("y").is_some()
        })
        .filter_map(|j| {
            let id = j.attribute("id")?;
            let x = j.attribute("x")?.parse::<f64>().ok()?;
            let y = j.attribute("y")?.parse::<f64>().ok()?;
            
            if x.is_finite() && y.is_finite() {
                Some(JunctionPoint {
                    id: id.to_string(),
                    lat: y,
                    lng: x,
                })
            } else {
                None
            }
        })
        .collect();

    console_log!("Parsed {} junction points", junction_points.len());

    let result = ParsedNetwork {
        lanes,
        bounds,
        tls,
        junctions,
        junction_points,
    };

    console_log!("WASM parsing complete!");
    
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
