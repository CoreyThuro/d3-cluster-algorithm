import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import usMapData from '../../../assets/json/counties-albers-10m.json';
import { Loader } from '../../../styles';


const rColors = {
  "Low": "#000066",      // Blue
  "Medium": "#bc770b",   // Yellow
  "High": "#800000"      // Red
};

const D3Map = ({ data }) => {
    

    const svgRef = useRef(null);
    const tooltipRef = useRef(null);

    const width = 1060;
    const height = 600;
    const [isLoading, setIsLoading] = useState(true);

   
    useEffect(() => {
    if (!data) {
        setIsLoading(true);
        return;
    }
    setIsLoading(false);
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)

    const g = svg.append('g');

    const zoomed = (event) => {
      const { transform } = event;
      g.attr("transform", transform.toString());
      g.attr("stroke-width", 1 / transform.k);
  
      const clusters = calculateClusters(plotData, transform.k);
      renderClusters(g, clusters, transform.k);

      g.selectAll(".individual").remove();

      const singletons = clusters.filter(d => !d.points[0].clustered)
      console.log(singletons)
      singletons.forEach(data => {
        console.log(data)
        if (data.points[0].type === "prop1") {
            plotPoints(g, data.points[0], data.points[0].r, false);
        } else if (data.points[0].type === "prop2") {
            plotPoints(g, data.points[0], data.points[0].r, true); 
        }
      });
          // renderIndividualPoints(g, plotData, transform.k);

  };
  


    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on("zoom", zoomed);

    svg.call(zoom);

    const projection = d3.geoAlbersUsa().translate([width / 2, height / 2]).scale(1130);

    function determineClusterColor(points) {
        const rCount = { "Low": 0, "Medium": 0, "High": 0 };
      
        points.forEach(point => {
          // Using call to safely check for property
          if (point.r && Object.prototype.hasOwnProperty.call(rCount, point.r)) {
            rCount[point.r]+=1;
          }
        });
      
        let max = "Low"; // Default r level
        let maxCount = rCount.Low;
        
        if (rCount.High > 0) {
          maxR = 'High'
          maxCount = rCount.High
        } else if (rCount.High === 0 && rCount.Medium > 0) {
          maxR = 'Medium'
          maxCount = rCount.Medium
        } else if (rCount.High === 0 && rCount.Medium === 0) {
          maxR = "Low"
          maxCount = rCount.Low
        }
        // Object.keys(rCount).forEach(r => {
        //   if (rCount[r] > maxCount) {
        //     maxr = r;
        //     maxCount = rCount[r];
        //   }
        // });
        return rColors[maxR];
      }
    
      function calculateClusters(data, scale) {
        const baseRadius = 50; 
        let clusters = [];
    
        data.forEach(point => point.clustered = false);
    
        if (scale < 6) {
            data.forEach(point => {
                const projected = projection([point.lon, point.lat]);
                if (projected) {
                    let addedToCluster = false;
                    clusters.forEach(cluster => {
                        const [cx, cy] = cluster.centroid;
                        const distance = Math.sqrt((cx - projected[0]) ** 2 + (cy - projected[1]) ** 2);
                        const requiredRadius = Math.max(baseRadius / scale, 10 + cluster.points.length);
                        if (distance < requiredRadius) {
                            if (cluster.points.length === 1) {
                                cluster.points[0].clustered = true; // Mark the first point if it wasn’t already
                            }
                            cluster.points.push(point);
                            cluster.centroid[0] = (cx * cluster.points.length + projected[0]) / (cluster.points.length + 1);
                            cluster.centroid[1] = (cy * cluster.points.length + projected[1]) / (cluster.points.length + 1);
                            point.clustered = true;  // Mark the point as clustered
                            addedToCluster = true;
                        }
                    });
    
                    if (!addedToCluster) {
                        clusters.push({
                            centroid: projected,
                            points: [point]
                        });
                    }
                }
            });
    
            const mergedClusters = [];
            clusters.forEach(cluster => {
                let merged = false;
                mergedClusters.forEach(mergeCluster => {
                    const [mcx, mcy] = mergeCluster.centroid;
                    const distance = Math.sqrt((mcx - cluster.centroid[0]) ** 2 + (mcy - cluster.centroid[1]) ** 2);
                    if (distance < baseRadius / scale) {
                        mergeCluster.points = [...mergeCluster.points, ...cluster.points];
                        mergeCluster.centroid[0] = (mcx * mergeCluster.points.length + cluster.centroid[0]) / (mergeCluster.points.length + 1);
                        mergeCluster.centroid[1] = (mcy * mergeCluster.points.length + cluster.centroid[1]) / (mergeCluster.points.length + 1);
                        mergeCluster.points.forEach(p => p.clustered = true); // Mark all points in the merged cluster as clustered
                        merged = true;
                    }
                });
                if (!merged) {
                    mergedClusters.push(cluster);
                }
            });
    
            clusters = mergedClusters;
        }
        return clusters;
    }
    
    console.log(data)
    
    function renderClusters(group, clusters, scale) {
      const clusterGroup = group.selectAll("circle.cluster")
          .data(clusters, d => d.centroid.toString());  // Use the centroid for unique identification
  
      clusterGroup.enter()
          .filter(d => d.points.length >1) 
          .append("circle")
          .attr("class", "cluster")
          .merge(clusterGroup)
          .attr("cx", d => d.centroid[0])
          .attr("cy", d => d.centroid[1])
          .attr("r", d => {
              if (d.points.length === 1) {
                  return 10;  // Fixed radius for individual points
              }
              {
                  let maxDistance = 0;
                  d.points.forEach(point => {
                      const projected = projection([point.lon, point.lat]);
                      const distance = Math.sqrt((d.centroid[0] - projected[0]) ** 2 + (d.centroid[1] - projected[1]) ** 2);
                      maxDistance = Math.max(maxDistance, distance);
                  });
                  return maxDistance + 10;  // Buffer distance around the farthest point
              }
          })
          .attr("fill", d => determineClusterColor(d.points))
          .attr("fill-opacity", d => d.points.length === 1 ? 1 : .5)
          .attr("stroke", "black")  // Optional: define a stroke for visibility
          .attr("stroke-width", d => d.points.length > 1 ? 2 : 1);
  
      clusterGroup.exit().remove();
  }
  

      
    const handleMouseOver = (event, dataPoint) => {
      console.log(dataPoint)
      d3.select(tooltipRef.current)
        .style('visibility', 'visible')
        .html(`T: ${dataPoint.t}<br>Type: ${dataPoint.type}<br>Latitude: ${dataPoint.lat}<br>Longitude: ${dataPoint.lon}`);
    };
  
    const handleMouseMove = (event) => {
      d3.select(tooltipRef.current)
     .style('top', `${event.layerY-40}px`)
     .style('left', `${event.layerX+40}px`)
    };
  
    const handleMouseOut = () => {
      d3.select(tooltipRef.current)
      .style("visibility", 'hidden');
    };

    const prepareDataPoints = (dataSet, rType) => dataSet.map(point => ({
      zip: {
          type: 'ZIP', 
          code: point.zip_code, 
          t: point.zip_t, 
          lat: point.zip_lat, 
          lon: point.zip_long, 
          r: rType 
      },
      ip: {
          type: 'I', 
          code: point.ip_zipcode, 
          t: point.ip_t, 
          lat: point.ip_lat, 
          lon: point.ip_long, 
          r: rType 
      },
  }));

  const flattenDataPoints = (dataSet) => 
  dataSet.reduce((acc, data) => {
      acc.push(data.zip); // Add ZIP data
      acc.push(data.ip);  // Add IP data
      return acc;
  }, []);


const lowrData = flattenDataPoints(prepareDataPoints(data.Low, "Low"));
const mediumrData = flattenDataPoints(prepareDataPoints(data.Medium, "Medium"));
const highrData = flattenDataPoints(prepareDataPoints(data.High, "High"));
const lowrIPData = flattenDataPoints(prepareDataPoints(data.dataIPLow, "Low"));
const mediumrIPData = flattenDataPoints(prepareDataPoints(data.dataIPMed, "Medium"));
const highrIPData = flattenDataPoints(prepareDataPoints(data.dataIPHi, "High"));

const plotData = [...lowrData, ...mediumrData, ...highrData, ...lowrIPData, ...mediumrIPData, ...highrIPData];
const circleRadius = 7.5; 
const lineLength = circleRadius * 2; 

const plotPoints = (group, dataPoint, rType, isIP) => {
  if (dataPoint.clustered) return;
    const color = rColors[rType];
    const projected = projection([dataPoint.lon, dataPoint.lat]);
    if (projected) {
        const pointGroup = group.append("g")
            .attr("class", "individual") 
            .attr("transform", `translate(${projected[0]}, ${projected[1]})`);

        const innerLineLength = circleRadius * 1.8;

        pointGroup.append("circle")
            .attr("r", circleRadius)
            .attr("fill", "white") 
            .attr("stroke", color)
            .attr("stroke-width", 2)
            .on("mouseover", (event) => handleMouseOver(event, dataPoint))
            .on("mousemove", (event) => handleMouseMove(event, projected))
            .on("mouseout", handleMouseOut);
           
        

        // Define the number of lines based on r type
        let numLines;
        switch (rType) {
            case "Low":
                numLines = 1;
                break;
            case "Medium":
                numLines = 2;
                break;
            case "High":
                numLines = 3;
                break;
            default:
                numLines = 0;
        }

        const step = lineLength / (numLines + 1);
        
        for (let i = 1; i <= numLines; i+=1) {
            const offset = step * i - lineLength / 2;
            if (isIP) {
                pointGroup.append("line")
                    .attr("x1", offset)
                    .attr("x2", offset)
                    .attr("y1", -circleRadius)
                    .attr("y2", circleRadius)
                    .attr("stroke", color)
                    .attr("stroke-width", 1)
                    .attr("stroke-linecap", "round")
                    
            } else {
                pointGroup.append("line")
                    .attr("x1", -circleRadius)
                    .attr("x2", circleRadius)
                    .attr("y1", offset)
                    .attr("y2", offset)
                    .attr("stroke", color)
                    .attr("stroke-width", 1)
                    .attr("stroke-linecap", "round") 
                   
            }
        }
    }
};

  
  

        g.selectAll('path')
        .data(topojson.feature(usMapData, usMapData.objects.states).features)
        .enter()
        .append('path')
        .attr('d', d3.geoPath())
        .attr('fill', 'rgba(200, 200, 200, 0.3)')
        .attr('stroke', '#A0A0A0')
        .attr('stroke-width', 1.)
        .attr('stroke-opacity', 1.)

        
    


const clusterData = calculateClusters(plotData, 1); 
const singles = clusterData.filter(d => !d.points[0].clustered)
singles.forEach(data => {
  if (data.points[0].type === "ZIP") {
      plotPoints(g, data.points[0], data.points[0].r, false); 
  } else if (data.points[0].type === "IP") {
      plotPoints(g, data.points[0], data.points[0].r, true);
  }
});
renderClusters(g, clusterData);


  const drawLegend = (svg) => {
    const legendRadius = 6;
  
    const addLinesToLegend = (g, color, numLines, isIP) => {
      const step = legendRadius * 2 / (numLines + 1);
      for (let i = 1; i <= numLines; i+=1) {
        const offset = step * i - legendRadius;
        if (isIP) {
          g.append("line")
            .attr("x1", offset)
            .attr("x2", offset)
            .attr("y1", -legendRadius)
            .attr("y2", legendRadius)
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("stroke-linecap", "round");
        } else {
          g.append("line")
            .attr("x1", -legendRadius)
            .attr("x2", legendRadius)
            .attr("y1", offset)
            .attr("y2", offset)
            .attr("stroke", color)
            .attr("stroke-width", 1)
            .attr("stroke-linecap", "round");
        }
      }
    };
  
    const legendData = [
      { label: "Low (ZIP)", color: rColors.Low, numLines: 1, isIP: false },
      { label: "Medium (ZIP)", color: rColors.Medium, numLines: 2, isIP: false },
      { label: "High (ZIP)", color: rColors.High, numLines: 3, isIP: false },
      { label: "Low (IP Address)", color: rColors.Low, numLines: 1, isIP: true },
      { label: "Medium (IP Address)", color: rColors.Medium, numLines: 2, isIP: true },
      { label: "High (IP Address)", color: rColors.High, numLines: 3, isIP: true }
    ];
  
    const legendX = 850; 
    const legendY = 400; 
    const legendSpacing = 20; 
  
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${legendX},${legendY})`);
  
    legendData.forEach((item, index) => {
      const legendItem = legend.append('g')
        .attr('class', 'legend-item')
        .attr('transform', `translate(0, ${index * legendSpacing})`);
  
      const symbolGroup = legendItem.append('g')
        .attr('transform', 'translate(15, 5)');
  
      symbolGroup.append('circle')
        .attr('r', legendRadius)
        .attr('fill', 'white')
        .attr('stroke', item.color);
  
      addLinesToLegend(symbolGroup, item.color, item.numLines, item.isIP);
  
      legendItem.append('text')
        .attr('x', 30) 
        .attr('y', 0)
        .attr("dy", "0.35em")
        .text(item.label);
    });
  };

drawLegend(svg); 

}, [data, isLoading]);

if (isLoading) {
    return <Loader />;
}

return (
    <div>
        <div ref={tooltipRef} style={{
            position: 'absolute',
            visibility: 'hidden',
            backgroundColor: 'white',
            border: 'solid',
            opacity: 1,
            padding: '5px',
            margin: "0px",
            borderWidth: "2px",
            borderRadius: "5px",
            pointerEvents: 'none'
        }} />
        <div ref={svgRef}/>
    </div>
);

};

export default D3Map;
