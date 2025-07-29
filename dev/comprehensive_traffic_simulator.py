#!/usr/bin/env python3
"""
Comprehensive Traffic Simulator for Addis Ababa
Supports multiple vehicle types with realistic traffic patterns
"""

import os
import sys
import subprocess
import time
import xml.etree.ElementTree as ET
from datetime import datetime
import matplotlib.pyplot as plt
import pandas as pd

class ComprehensiveTrafficSimulator:
    def __init__(self):
        self.sumo_config = "addis_ababa_simulation.sumocfg"
        self.network_file = "/Volumes/PortableSSD/Senior Project/AddisAbabaSumo/AddisAbaba.net.xml"
        self.trips_file = "enhanced_trips.xml"
        self.vehicle_types_file = "vehicle_types.xml"
        
        # Simulation parameters
        self.simulation_duration = 86400  # 24 hours in seconds
        self.time_step = 1.0  # seconds
        
        # Output files
        self.output_files = {
            'summary': 'summary.xml',
            'tripinfo': 'tripinfo.xml',
            'vehroute': 'vehroute.xml',
            'fcd': 'fcd.xml',
            'queue': 'queue.xml'
        }
        
        # Statistics storage
        self.statistics = {}
        
    def check_prerequisites(self):
        """Check if all required files exist"""
        required_files = [
            self.network_file,
            self.trips_file,
            self.vehicle_types_file,
            self.sumo_config
        ]
        
        missing_files = []
        for file in required_files:
            if not os.path.exists(file):
                missing_files.append(file)
        
        if missing_files:
            print("❌ Missing required files:")
            for file in missing_files:
                print(f"   - {file}")
            return False
        
        print("✅ All required files found")
        return True
    
    def run_simulation(self, gui=False):
        """Run the SUMO simulation"""
        print("🚀 Starting Addis Ababa Traffic Simulation...")
        print("=" * 60)
        
        # Check prerequisites
        if not self.check_prerequisites():
            print("❌ Cannot start simulation due to missing files")
            return False
        
        # Build SUMO command
        sumo_cmd = ["sumo"]
        if gui:
            sumo_cmd = ["sumo-gui"]
        
        sumo_cmd.extend([
            "-c", self.sumo_config,
            "--time-to-teleport", "300",
            "--collision.action", "warn",
            "--verbose", "true",
            "--no-step-log", "true"
        ])
        
        try:
            print(f"📋 Running command: {' '.join(sumo_cmd)}")
            print(f"⏱️  Simulation duration: {self.simulation_duration} seconds (24 hours)")
            print(f"🔄 Time step: {self.time_step} second(s)")
            
            # Start simulation
            start_time = time.time()
            process = subprocess.Popen(
                sumo_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            
            # Monitor simulation progress
            if not gui:
                self.monitor_simulation(process)
            
            # Wait for completion
            stdout, stderr = process.communicate()
            end_time = time.time()
            
            if process.returncode == 0:
                print(f"✅ Simulation completed successfully in {end_time - start_time:.2f} seconds")
                return True
            else:
                print(f"❌ Simulation failed with return code {process.returncode}")
                if stderr:
                    print("Error output:")
                    print(stderr)
                return False
                
        except Exception as e:
            print(f"❌ Error running simulation: {e}")
            return False
    
    def monitor_simulation(self, process):
        """Monitor simulation progress"""
        print("📊 Monitoring simulation progress...")
        
        # Simple progress monitoring
        while process.poll() is None:
            time.sleep(5)  # Check every 5 seconds
            # Could add more sophisticated progress tracking here
    
    def analyze_results(self):
        """Analyze simulation results"""
        print("\n📈 Analyzing simulation results...")
        print("=" * 50)
        
        # Check if output files exist
        for output_type, filename in self.output_files.items():
            if os.path.exists(filename):
                print(f"✅ {output_type}: {filename}")
                self.analyze_output_file(output_type, filename)
            else:
                print(f"❌ {output_type}: {filename} (not found)")
    
    def analyze_output_file(self, output_type, filename):
        """Analyze specific output file"""
        try:
            if output_type == 'tripinfo':
                self.analyze_tripinfo(filename)
            elif output_type == 'summary':
                self.analyze_summary(filename)
            elif output_type == 'fcd':
                self.analyze_fcd(filename)
        except Exception as e:
            print(f"⚠️  Error analyzing {filename}: {e}")
    
    def analyze_tripinfo(self, filename):
        """Analyze trip information"""
        print(f"📊 Analyzing trip information from {filename}...")
        
        try:
            tree = ET.parse(filename)
            root = tree.getroot()
            
            # Collect trip statistics
            trips = []
            for tripinfo in root.findall('tripinfo'):
                trip_data = {
                    'id': tripinfo.get('id'),
                    'depart': float(tripinfo.get('depart', 0)),
                    'arrival': float(tripinfo.get('arrival', 0)),
                    'duration': float(tripinfo.get('duration', 0)),
                    'waitingTime': float(tripinfo.get('waitingTime', 0)),
                    'timeLoss': float(tripinfo.get('timeLoss', 0)),
                    'routeLength': float(tripinfo.get('routeLength', 0)),
                    'vType': tripinfo.get('vType', 'unknown')
                }
                trips.append(trip_data)
            
            if trips:
                # Calculate statistics by vehicle type
                vehicle_stats = {}
                for trip in trips:
                    vtype = trip['vType']
                    if vtype not in vehicle_stats:
                        vehicle_stats[vtype] = {
                            'count': 0,
                            'total_duration': 0,
                            'total_waiting': 0,
                            'total_distance': 0
                        }
                    
                    vehicle_stats[vtype]['count'] += 1
                    vehicle_stats[vtype]['total_duration'] += trip['duration']
                    vehicle_stats[vtype]['total_waiting'] += trip['waitingTime']
                    vehicle_stats[vtype]['total_distance'] += trip['routeLength']
                
                # Display statistics
                print("\nVehicle Type Performance:")
                print("-" * 40)
                for vtype, stats in vehicle_stats.items():
                    avg_duration = stats['total_duration'] / stats['count']
                    avg_waiting = stats['total_waiting'] / stats['count']
                    avg_distance = stats['total_distance'] / stats['count']
                    
                    print(f"{vtype:12} | Count: {stats['count']:4d} | "
                          f"Avg Duration: {avg_duration:6.1f}s | "
                          f"Avg Waiting: {avg_waiting:6.1f}s | "
                          f"Avg Distance: {avg_distance:6.1f}m")
                
                # Store for later use
                self.statistics['tripinfo'] = vehicle_stats
                
        except Exception as e:
            print(f"❌ Error parsing tripinfo: {e}")
    
    def analyze_summary(self, filename):
        """Analyze simulation summary"""
        print(f"📊 Analyzing simulation summary from {filename}...")
        
        try:
            tree = ET.parse(filename)
            root = tree.getroot()
            
            # Extract key metrics
            summary_data = {}
            for step in root.findall('step'):
                time = float(step.get('time', 0))
                summary_data[time] = {
                    'loaded': int(step.get('loaded', 0)),
                    'inserted': int(step.get('inserted', 0)),
                    'running': int(step.get('running', 0)),
                    'waiting': int(step.get('waiting', 0))
                }
            
            if summary_data:
                # Calculate overall statistics
                total_loaded = sum(data['loaded'] for data in summary_data.values())
                total_inserted = sum(data['inserted'] for data in summary_data.values())
                max_running = max(data['running'] for data in summary_data.values())
                max_waiting = max(data['waiting'] for data in summary_data.values())
                
                print(f"\nSimulation Summary:")
                print(f"Total vehicles loaded: {total_loaded}")
                print(f"Total vehicles inserted: {total_inserted}")
                print(f"Maximum vehicles running: {max_running}")
                print(f"Maximum vehicles waiting: {max_waiting}")
                
                # Store for later use
                self.statistics['summary'] = summary_data
                
        except Exception as e:
            print(f"❌ Error parsing summary: {e}")
    
    def analyze_fcd(self, filename):
        """Analyze floating car data"""
        print(f"📊 Analyzing floating car data from {filename}...")
        
        try:
            tree = ET.parse(filename)
            root = tree.getroot()
            
            # Extract vehicle positions and speeds
            vehicle_data = {}
            for timestep in root.findall('timestep'):
                time = float(timestep.get('time', 0))
                for vehicle in timestep.findall('vehicle'):
                    vid = vehicle.get('id')
                    if vid not in vehicle_data:
                        vehicle_data[vid] = []
                    
                    vehicle_data[vid].append({
                        'time': time,
                        'x': float(vehicle.get('x', 0)),
                        'y': float(vehicle.get('y', 0)),
                        'speed': float(vehicle.get('speed', 0)),
                        'lane': vehicle.get('lane', ''),
                        'vType': vehicle.get('vType', 'unknown')
                    })
            
            if vehicle_data:
                # Calculate average speeds by vehicle type
                speed_stats = {}
                for vid, data in vehicle_data.items():
                    if data:
                        vtype = data[0].get('vType', 'unknown')
                        avg_speed = sum(d['speed'] for d in data) / len(data)
                        
                        if vtype not in speed_stats:
                            speed_stats[vtype] = []
                        speed_stats[vtype].append(avg_speed)
                
                print(f"\nAverage Speeds by Vehicle Type:")
                print("-" * 35)
                for vtype, speeds in speed_stats.items():
                    avg_speed = sum(speeds) / len(speeds)
                    print(f"{vtype:12} | Avg Speed: {avg_speed:6.1f} m/s")
                
                # Store for later use
                self.statistics['fcd'] = speed_stats
                
        except Exception as e:
            print(f"❌ Error parsing FCD: {e}")
    
    def generate_visualizations(self):
        """Generate visualization plots"""
        print("\n📊 Generating visualizations...")
        
        try:
            # Create output directory for plots
            os.makedirs('plots', exist_ok=True)
            
            # Vehicle type distribution
            if 'tripinfo' in self.statistics:
                self.plot_vehicle_distribution()
            
            # Traffic flow over time
            if 'summary' in self.statistics:
                self.plot_traffic_flow()
            
            # Speed analysis
            if 'fcd' in self.statistics:
                self.plot_speed_analysis()
            
            print("✅ Visualizations saved to 'plots' directory")
            
        except Exception as e:
            print(f"❌ Error generating visualizations: {e}")
    
    def plot_vehicle_distribution(self):
        """Plot vehicle type distribution"""
        vehicle_stats = self.statistics['tripinfo']
        
        vehicle_types = list(vehicle_stats.keys())
        counts = [stats['count'] for stats in vehicle_stats.values()]
        
        plt.figure(figsize=(10, 6))
        plt.bar(vehicle_types, counts, color='skyblue')
        plt.title('Vehicle Type Distribution')
        plt.xlabel('Vehicle Type')
        plt.ylabel('Number of Vehicles')
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig('plots/vehicle_distribution.png', dpi=300, bbox_inches='tight')
        plt.close()
    
    def plot_traffic_flow(self):
        """Plot traffic flow over time"""
        summary_data = self.statistics['summary']
        
        times = list(summary_data.keys())
        running = [data['running'] for data in summary_data.values()]
        waiting = [data['waiting'] for data in summary_data.values()]
        
        plt.figure(figsize=(12, 6))
        plt.plot(times, running, label='Running Vehicles', color='green')
        plt.plot(times, waiting, label='Waiting Vehicles', color='red')
        plt.title('Traffic Flow Over Time')
        plt.xlabel('Time (seconds)')
        plt.ylabel('Number of Vehicles')
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig('plots/traffic_flow.png', dpi=300, bbox_inches='tight')
        plt.close()
    
    def plot_speed_analysis(self):
        """Plot speed analysis by vehicle type"""
        speed_stats = self.statistics['fcd']
        
        vehicle_types = list(speed_stats.keys())
        avg_speeds = [sum(speeds)/len(speeds) for speeds in speed_stats.values()]
        
        plt.figure(figsize=(10, 6))
        plt.bar(vehicle_types, avg_speeds, color='orange')
        plt.title('Average Speed by Vehicle Type')
        plt.xlabel('Vehicle Type')
        plt.ylabel('Average Speed (m/s)')
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig('plots/speed_analysis.png', dpi=300, bbox_inches='tight')
        plt.close()
    
    def generate_report(self):
        """Generate a comprehensive simulation report"""
        print("\n📋 Generating simulation report...")
        
        report_file = "simulation_report.txt"
        with open(report_file, 'w') as f:
            f.write("ADDIS ABABA TRAFFIC SIMULATION REPORT\n")
            f.write("=" * 50 + "\n\n")
            f.write(f"Simulation Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Network File: {self.network_file}\n")
            f.write(f"Trips File: {self.trips_file}\n")
            f.write(f"Simulation Duration: {self.simulation_duration} seconds (24 hours)\n\n")
            
            # Add statistics
            if 'tripinfo' in self.statistics:
                f.write("VEHICLE TYPE PERFORMANCE:\n")
                f.write("-" * 30 + "\n")
                for vtype, stats in self.statistics['tripinfo'].items():
                    avg_duration = stats['total_duration'] / stats['count']
                    avg_waiting = stats['total_waiting'] / stats['count']
                    f.write(f"{vtype}: {stats['count']} vehicles, "
                           f"avg duration: {avg_duration:.1f}s, "
                           f"avg waiting: {avg_waiting:.1f}s\n")
                f.write("\n")
            
            if 'summary' in self.statistics:
                summary_data = self.statistics['summary']
                total_loaded = sum(data['loaded'] for data in summary_data.values())
                max_running = max(data['running'] for data in summary_data.values())
                f.write(f"SIMULATION SUMMARY:\n")
                f.write(f"Total vehicles loaded: {total_loaded}\n")
                f.write(f"Maximum vehicles running: {max_running}\n\n")
        
        print(f"✅ Report saved to {report_file}")
    
    def run_complete_simulation(self, gui=False):
        """Run complete simulation workflow"""
        print("🚀 Starting Complete Addis Ababa Traffic Simulation Workflow")
        print("=" * 70)
        
        # Step 1: Run simulation
        success = self.run_simulation(gui)
        if not success:
            print("❌ Simulation failed. Stopping workflow.")
            return False
        
        # Step 2: Analyze results
        self.analyze_results()
        
        # Step 3: Generate visualizations
        self.generate_visualizations()
        
        # Step 4: Generate report
        self.generate_report()
        
        print("\n🎉 Complete simulation workflow finished successfully!")
        print("📁 Generated files:")
        print("  - Output XML files (summary.xml, tripinfo.xml, etc.)")
        print("  - Visualization plots in 'plots' directory")
        print("  - Simulation report (simulation_report.txt)")
        
        return True

def main():
    """Main function to run the comprehensive traffic simulator"""
    print("🚀 Comprehensive Traffic Simulator for Addis Ababa")
    print("=" * 60)
    
    # Create simulator instance
    simulator = ComprehensiveTrafficSimulator()
    
    # Check if GUI mode is requested
    gui_mode = '--gui' in sys.argv or '-g' in sys.argv
    
    if gui_mode:
        print("🖥️  Running in GUI mode")
    else:
        print("🖥️  Running in command-line mode")
    
    # Run complete simulation
    success = simulator.run_complete_simulation(gui=gui_mode)
    
    if success:
        print("\n✅ Simulation completed successfully!")
        print("📊 Check the generated files and plots for detailed analysis.")
    else:
        print("\n❌ Simulation failed. Please check the error messages above.")

if __name__ == "__main__":
    main()
           