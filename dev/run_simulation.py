#!/usr/bin/env python3
"""
Addis Ababa Traffic Simulation Runner
Orchestrates the complete simulation workflow
"""

import os
import sys
import subprocess
import time

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n🔄 {description}")
    print(f"📋 Command: {' '.join(command)}")
    
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        print(f"✅ {description} completed successfully")
        if result.stdout:
            print("Output:", result.stdout.strip())
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed with return code {e.returncode}")
        if e.stdout:
            print("Stdout:", e.stdout.strip())
        if e.stderr:
            print("Stderr:", e.stderr.strip())
        return False
    except FileNotFoundError:
        print(f"❌ Command not found: {command[0]}")
        return False

def check_sumo_installation():
    """Check if SUMO is installed and accessible"""
    print("🔍 Checking SUMO installation...")
    
    try:
        result = subprocess.run(['sumo', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ SUMO is installed and accessible")
            return True
        else:
            print("❌ SUMO is installed but not working properly")
            return False
    except FileNotFoundError:
        print("❌ SUMO is not installed or not in PATH")
        print("💡 Please install SUMO from: https://sumo.dlr.de/docs/Downloads.php")
        return False

def main():
    """Main workflow runner"""
    print("🚀 Addis Ababa Traffic Simulation Workflow")
    print("=" * 60)
    
    # Check SUMO installation
    if not check_sumo_installation():
        print("❌ Cannot proceed without SUMO. Please install it first.")
        return False
    
    # Step 1: Extract network data
    print("\n📊 Step 1: Extracting network data...")
    
    if not os.path.exists("edges.txt"):
        print("🔄 Running edge extraction...")
        if not run_command(['python3', 'edgeIDExtractor.py'], "Edge extraction"):
            print("❌ Edge extraction failed. Stopping workflow.")
            return False
    else:
        print("✅ Edge data already exists")
    
    if not os.path.exists("nodes.txt"):
        print("🔄 Running node extraction...")
        if not run_command(['python3', 'nodeIDExtractor.py'], "Node extraction"):
            print("❌ Node extraction failed. Stopping workflow.")
            return False
    else:
        print("✅ Node data already exists")
    
    # Step 2: Generate enhanced trips
    print("\n🚗 Step 2: Generating enhanced trips...")
    
    if not os.path.exists("enhanced_trips.xml"):
        print("🔄 Running enhanced trip generation...")
        if not run_command(['python3', 'enhanced_trip_generator.py'], "Enhanced trip generation"):
            print("❌ Trip generation failed. Stopping workflow.")
            return False
    else:
        print("✅ Enhanced trips already exist")
    
    # Step 3: Run comprehensive simulation
    print("\n🎮 Step 3: Running comprehensive simulation...")
    
    # Check if GUI mode is requested
    gui_mode = '--gui' in sys.argv or '-g' in sys.argv
    
    if gui_mode:
        print("🖥️  Running in GUI mode")
        if not run_command(['python3', 'comprehensive_traffic_simulator.py', '--gui'], "Comprehensive simulation"):
            print("❌ Simulation failed. Stopping workflow.")
            return False
    else:
        print("🖥️  Running in command-line mode")
        if not run_command(['python3', 'comprehensive_traffic_simulator.py'], "Comprehensive simulation"):
            print("❌ Simulation failed. Stopping workflow.")
            return False
    
    # Step 4: Display results summary
    print("\n📈 Step 4: Simulation Results Summary")
    print("=" * 50)
    
    # Check for generated files
    output_files = [
        "summary.xml",
        "tripinfo.xml", 
        "vehroute.xml",
        "fcd.xml",
        "simulation_report.txt"
    ]
    
    print("📁 Generated files:")
    for file in output_files:
        if os.path.exists(file):
            size = os.path.getsize(file)
            print(f"  ✅ {file} ({size:,} bytes)")
        else:
            print(f"  ❌ {file} (not found)")
    
    # Check for plots directory
    if os.path.exists("plots"):
        plot_files = os.listdir("plots")
        print(f"  ✅ plots/ directory ({len(plot_files)} files)")
        for plot in plot_files:
            print(f"    - {plot}")
    else:
        print("  ❌ plots/ directory (not found)")
    
    print("\n🎉 Complete workflow finished successfully!")
    print("\n📋 Next steps:")
    print("  1. Check simulation_report.txt for detailed analysis")
    print("  2. View plots in the 'plots' directory")
    print("  3. Analyze XML output files for detailed data")
    print("  4. Run with --gui flag to see visual simulation")
    
    return True

if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)