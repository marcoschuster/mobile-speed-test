import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import SpeedCircle from '../components/SpeedCircle';
import StatCard from '../components/StatCard';
import SpeedTestService from '../services/SpeedTestService';

const SpeedTestScreen = () => {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentType, setCurrentType] = useState('Ready');
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [ping, setPing] = useState(0);
  const [peaks, setPeaks] = useState({
    download: 0,
    upload: 0,
    ping: Infinity,
  });
  const [speedHistory, setSpeedHistory] = useState([]);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [progressText, setProgressText] = useState('');

  useEffect(() => {
    loadPeaks();
  }, []);

  const loadPeaks = async () => {
    await SpeedTestService.loadPeaks();
    setPeaks(SpeedTestService.getPeaks());
  };

  const startTest = async () => {
    setIsTestRunning(true);
    setCurrentSpeed(0);
    setCurrentType('Testing');
    setDownloadSpeed(0);
    setUploadSpeed(0);
    setPing(0);
    setSpeedHistory([]);

    await SpeedTestService.runSpeedTest(
      (progress, type) => {
        setProgressText(progress);
        if (type === 'ping') {
          setCurrentType('Ping');
        } else if (type === 'download') {
          setCurrentType('Download');
        } else if (type === 'upload') {
          setCurrentType('Upload');
        }
      },
      (speed, type) => {
        // Real-time speed updates
        setCurrentSpeed(speed);
        setSpeedHistory(prev => [...prev, { speed, type, time: Date.now() }]);
      },
      async (result) => {
        setDownloadSpeed(result.download);
        setUploadSpeed(result.upload);
        setPing(result.ping);
        setCurrentSpeed(result.download);
        setCurrentType('Complete');
        
        // Reload peaks
        await SpeedTestService.loadPeaks();
        setPeaks(SpeedTestService.getPeaks());
        
        setTimeout(() => {
          setIsTestRunning(false);
          setCurrentSpeed(0);
          setCurrentType('Ready');
          setProgressText('');
        }, 3000);
      },
      (error) => {
        Alert.alert('Test Failed', error);
        setIsTestRunning(false);
        setCurrentSpeed(0);
        setCurrentType('Error');
        setProgressText('');
      }
    );
  };

  const toggleBackgroundMode = () => {
    setBackgroundMode(!backgroundMode);
    Alert.alert(
      'Background Mode',
      backgroundMode ? 'Background mode disabled' : 'Background mode enabled. The app will continue testing in the background.',
      [{ text: 'OK' }]
    );
  };

  const stopTest = () => {
    SpeedTestService.stopTest();
    setIsTestRunning(false);
    setCurrentSpeed(0);
    setCurrentType('Ready');
    setProgressText('');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <SpeedCircle
        speed={currentSpeed}
        type={currentType}
        isTesting={isTestRunning}
      />

      <View style={styles.graphContainer}>
        <Text style={styles.graphTitle}>Speed History</Text>
        <View style={styles.graph}>
          {speedHistory.length > 0 ? (
            speedHistory.slice(-20).map((point, index) => (
              <View
                key={index}
                style={[
                  styles.graphBar,
                  {
                    height: Math.max(point.speed * 2, 5),
                    backgroundColor: point.type === 'download' ? '#667eea' : '#764ba2',
                  },
                ]}
              />
            ))
          ) : (
            <Text style={styles.noDataText}>Run a test to see speed graph</Text>
          )}
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          label="Download"
          value={downloadSpeed}
          peak={peaks.download}
        />
        <StatCard
          label="Upload"
          value={uploadSpeed}
          peak={peaks.upload}
        />
        <StatCard
          label="Ping"
          value={ping}
          peak={peaks.ping === Infinity ? 'N/A' : peaks.ping}
          unit="ms"
        />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity 
          style={[styles.backgroundButton, backgroundMode && styles.backgroundButtonActive]} 
          onPress={toggleBackgroundMode}
        >
          <Text style={styles.backgroundButtonText}>
            {backgroundMode ? 'Background: ON' : 'Background: OFF'}
          </Text>
        </TouchableOpacity>

        {!isTestRunning ? (
          <TouchableOpacity style={styles.testButton} onPress={startTest}>
            <Text style={styles.testButtonText}>Start Test</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.testButton, styles.stopButton]} onPress={stopTest}>
            <Text style={styles.testButtonText}>Stop Test</Text>
          </TouchableOpacity>
        )}
      </View>

      {progressText ? (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>{progressText}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
  },
  graphContainer: {
    width: '100%',
    marginVertical: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  graphTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  graph: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  graphBar: {
    width: 8,
    marginHorizontal: 1,
    borderRadius: 2,
  },
  noDataText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 30,
  },
  controls: {
    alignItems: 'center',
    marginVertical: 20,
  },
  backgroundButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 15,
  },
  backgroundButtonActive: {
    backgroundColor: '#28a745',
  },
  backgroundButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#667eea',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  stopButton: {
    backgroundColor: '#dc3545',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
  },
});

export default SpeedTestScreen;
