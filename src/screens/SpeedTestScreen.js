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
