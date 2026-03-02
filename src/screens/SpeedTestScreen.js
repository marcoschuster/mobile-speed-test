import React, { useState, useEffect, useRef } from 'react';
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

const INTERVALS = [
  { key: '30m', label: '30 min', ms: 30 * 60 * 1000 },
  { key: '1h', label: '1 h', ms: 60 * 60 * 1000 },
  { key: '3h', label: '3 h', ms: 3 * 60 * 60 * 1000 },
  { key: '6h', label: '6 h', ms: 6 * 60 * 60 * 1000 },
  { key: '12h', label: '12 h', ms: 12 * 60 * 60 * 1000 },
  { key: '24h', label: '24 h', ms: 24 * 60 * 60 * 1000 },
];

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
  const [backgroundInterval, setBackgroundInterval] = useState(null);
  const [showIntervalOptions, setShowIntervalOptions] = useState(false);
  const [progressText, setProgressText] = useState('');

  const backgroundTimerRef = useRef(null);

  useEffect(() => {
    loadPeaks();
    return () => {
      // Cleanup background timer on unmount
      if (backgroundTimerRef.current) {
        clearInterval(backgroundTimerRef.current);
      }
    };
  }, []);

  const loadPeaks = async () => {
    await SpeedTestService.loadPeaks();
    setPeaks(SpeedTestService.getPeaks());
  };

  const runTest = async () => {
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
        setCurrentSpeed(speed);
        setSpeedHistory((prev) => [...prev, { speed, type, time: Date.now() }]);
      },
      async (result) => {
        setDownloadSpeed(result.download);
        setUploadSpeed(result.upload);
        setPing(result.ping);
        setCurrentSpeed(result.download);
        setCurrentType('Complete');

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

  const startTest = () => {
    runTest();
  };

  const stopTest = () => {
    SpeedTestService.stopTest();
    setIsTestRunning(false);
    setCurrentSpeed(0);
    setCurrentType('Ready');
    setProgressText('');
  };

  const toggleBackgroundMode = () => {
    if (backgroundMode) {
      // Turn off background mode
      if (backgroundTimerRef.current) {
        clearInterval(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
      }
      setBackgroundMode(false);
      setBackgroundInterval(null);
      setShowIntervalOptions(false);
      Alert.alert('Background Testing', 'Background testing disabled.');
    } else {
      // Show interval options
      setShowIntervalOptions(!showIntervalOptions);
    }
  };

  const selectInterval = (interval) => {
    // Clear existing timer
    if (backgroundTimerRef.current) {
      clearInterval(backgroundTimerRef.current);
      backgroundTimerRef.current = null;
    }

    setBackgroundInterval(interval.key);
    setBackgroundMode(true);
    setShowIntervalOptions(false);

    // Start the background timer
    backgroundTimerRef.current = setInterval(() => {
      // Only run if not already running a test
      if (!SpeedTestService.isTestRunning) {
        runTest();
      }
    }, interval.ms);

    Alert.alert(
      'Background Testing',
      `Background testing enabled.\nInterval: every ${interval.label}\nThe speed test will run automatically.`,
      [{ text: 'OK' }]
    );
  };

  const getIntervalLabel = () => {
    if (!backgroundInterval) return '';
    const found = INTERVALS.find((i) => i.key === backgroundInterval);
    return found ? found.label : '';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <SpeedCircle
        speed={currentSpeed}
        type={currentType}
        isTesting={isTestRunning}
      />

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
        {/* Speed Test button first */}
        {!isTestRunning ? (
          <TouchableOpacity style={styles.testButton} onPress={startTest}>
            <Text style={styles.testButtonText}>Start Test</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.testButton, styles.stopButton]} onPress={stopTest}>
            <Text style={styles.testButtonText}>Stop Test</Text>
          </TouchableOpacity>
        )}

        {/* Background testing button below */}
        <TouchableOpacity
          style={[styles.backgroundButton, backgroundMode && styles.backgroundButtonActive]}
          onPress={toggleBackgroundMode}
        >
          <Text style={styles.backgroundButtonText}>
            {backgroundMode
              ? `Background: ON (${getIntervalLabel()})`
              : 'Background Testing'}
          </Text>
        </TouchableOpacity>

        {/* Interval options */}
        {showIntervalOptions && !backgroundMode && (
          <View style={styles.intervalContainer}>
            <Text style={styles.intervalTitle}>Select Interval</Text>
            <View style={styles.intervalGrid}>
              {INTERVALS.map((interval) => (
                <TouchableOpacity
                  key={interval.key}
                  style={styles.intervalButton}
                  onPress={() => selectInterval(interval)}
                >
                  <Text style={styles.intervalButtonText}>{interval.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
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
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 30,
  },
  controls: {
    alignItems: 'center',
    marginVertical: 20,
    width: '100%',
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
    marginBottom: 15,
  },
  stopButton: {
    backgroundColor: '#dc3545',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backgroundButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  backgroundButtonActive: {
    backgroundColor: '#28a745',
  },
  backgroundButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  intervalContainer: {
    marginTop: 14,
    width: '100%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  intervalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  intervalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  intervalButton: {
    backgroundColor: '#667eea',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  intervalButtonText: {
    color: '#fff',
    fontSize: 13,
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
