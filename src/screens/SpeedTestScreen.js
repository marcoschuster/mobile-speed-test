import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Speedometer from '../components/Speedometer';
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
  const [currentType, setCurrentType] = useState('Ready');
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [ping, setPing] = useState(0);
  const [liveDownload, setLiveDownload] = useState(0);
  const [liveUpload, setLiveUpload] = useState(0);
  const [livePing, setLivePing] = useState(0);
  const [peaks, setPeaks] = useState({ download: 0, upload: 0, ping: 0 });
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [backgroundInterval, setBackgroundInterval] = useState(null);
  const [showIntervalOptions, setShowIntervalOptions] = useState(false);
  const [progressText, setProgressText] = useState('');

  const backgroundTimerRef = useRef(null);

  useEffect(() => {
    loadPeaks();
    return () => {
      if (backgroundTimerRef.current) clearInterval(backgroundTimerRef.current);
    };
  }, []);

  const loadPeaks = async () => {
    await SpeedTestService.loadPeaks();
    setPeaks(SpeedTestService.getPeaks());
  };

  const runTest = async () => {
    setIsTestRunning(true);
    setCurrentType('Testing');
    setDownloadSpeed(0);
    setUploadSpeed(0);
    setPing(0);
    setLiveDownload(0);
    setLiveUpload(0);
    setLivePing(0);

    await SpeedTestService.runSpeedTest(
      (progress, type) => {
        setProgressText(progress);
        if (type === 'ping') setCurrentType('Ping');
        else if (type === 'download') setCurrentType('Download');
        else if (type === 'upload') setCurrentType('Upload');
      },
      (speed, type) => {
        if (type === 'download') setLiveDownload(speed);
        else if (type === 'upload') setLiveUpload(speed);
      },
      async (result) => {
        setDownloadSpeed(result.download);
        setUploadSpeed(result.upload);
        setPing(result.ping);
        setLivePing(result.ping);
        setLiveDownload(result.download);
        setLiveUpload(result.upload);
        setCurrentType('Complete');

        await SpeedTestService.loadPeaks();
        setPeaks(SpeedTestService.getPeaks());

        setTimeout(() => {
          setIsTestRunning(false);
          setCurrentType('Ready');
          setProgressText('');
          setLiveDownload(0);
          setLiveUpload(0);
          setLivePing(0);
        }, 4000);
      },
      (error) => {
        Alert.alert('Test Failed', error);
        setIsTestRunning(false);
        setCurrentType('Error');
        setProgressText('');
        setLiveDownload(0);
        setLiveUpload(0);
        setLivePing(0);
      },
      (pingSample) => {
        setLivePing(pingSample);
      }
    );
  };

  const startTest = () => runTest();

  const stopTest = () => {
    SpeedTestService.stopTest();
    setIsTestRunning(false);
    setCurrentType('Ready');
    setProgressText('');
    setLiveDownload(0);
    setLiveUpload(0);
    setLivePing(0);
  };

  const toggleBackgroundMode = () => {
    if (backgroundMode) {
      if (backgroundTimerRef.current) {
        clearInterval(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
      }
      setBackgroundMode(false);
      setBackgroundInterval(null);
      setShowIntervalOptions(false);
      Alert.alert('Background Testing', 'Background testing disabled.');
    } else {
      setShowIntervalOptions(!showIntervalOptions);
    }
  };

  const selectInterval = (interval) => {
    if (backgroundTimerRef.current) {
      clearInterval(backgroundTimerRef.current);
      backgroundTimerRef.current = null;
    }
    setBackgroundInterval(interval.key);
    setBackgroundMode(true);
    setShowIntervalOptions(false);
    backgroundTimerRef.current = setInterval(() => {
      if (!SpeedTestService.isTestRunning) runTest();
    }, interval.ms);
    Alert.alert('Background Testing', `Enabled — every ${interval.label}`, [{ text: 'OK' }]);
  };

  const getIntervalLabel = () => {
    if (!backgroundInterval) return '';
    const found = INTERVALS.find((i) => i.key === backgroundInterval);
    return found ? found.label : '';
  };

  // ── Speedometer props based on current phase ──
  const getNeedleColor = () => {
    switch (currentType) {
      case 'Download': return '#EAB308'; // yellow
      case 'Upload':   return '#3B82F6'; // blue
      case 'Ping':     return '#EF4444'; // red
      case 'Complete': return '#667eea';
      default:         return '#ccc';
    }
  };

  const getSpeedValue = () => {
    switch (currentType) {
      case 'Download': return liveDownload;
      case 'Upload':   return liveUpload;
      case 'Ping':     return livePing;
      case 'Complete': return downloadSpeed;
      default:         return 0;
    }
  };

  const getMaxValue = () => {
    if (currentType === 'Ping') return 1500;
    return 200;
  };

  const getSpeedLabel = () => {
    switch (currentType) {
      case 'Download': return 'DOWNLOAD';
      case 'Upload':   return 'UPLOAD';
      case 'Ping':     return 'PING';
      case 'Complete': return 'COMPLETE';
      case 'Testing':  return 'CONNECTING';
      default:         return '';
    }
  };

  const getSpeedUnit = () => {
    if (currentType === 'Ping') return 'ms';
    return 'Mbps';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Speedometer ── */}
      <View style={styles.speedoWrap}>
        <Speedometer
          speed={getSpeedValue()}
          maxValue={getMaxValue()}
          label={getSpeedLabel()}
          unit={getSpeedUnit()}
          needleColor={getNeedleColor()}
        />
      </View>

      {/* ── Progress ── */}
      {progressText ? (
        <Text style={styles.progressText}>{progressText}</Text>
      ) : null}

      {/* ── Stat Cards ── */}
      <View style={styles.statsGrid}>
        <StatCard label="Download" value={downloadSpeed} peak={peaks.download} />
        <StatCard label="Upload" value={uploadSpeed} peak={peaks.upload} />
        <StatCard label="Ping" value={ping} peak={peaks.ping === 0 ? 'N/A' : peaks.ping} unit="ms" />
      </View>

      {/* ── Controls ── */}
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

        <TouchableOpacity
          style={[styles.bgButton, backgroundMode && styles.bgButtonActive]}
          onPress={toggleBackgroundMode}
        >
          <Text style={[styles.bgButtonText, backgroundMode && styles.bgButtonTextActive]}>
            {backgroundMode ? `Background: ON (${getIntervalLabel()})` : 'Background Testing'}
          </Text>
        </TouchableOpacity>

        {showIntervalOptions && !backgroundMode && (
          <View style={styles.intervalBox}>
            <Text style={styles.intervalTitle}>Select Interval</Text>
            <View style={styles.intervalGrid}>
              {INTERVALS.map((iv) => (
                <TouchableOpacity key={iv.key} style={styles.intervalBtn} onPress={() => selectInterval(iv)}>
                  <Text style={styles.intervalBtnText}>{iv.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 34,
  },

  /* Speedometer */
  speedoWrap: {
    marginTop: 4,
    marginBottom: 8,
    alignItems: 'center',
  },

  /* Progress */
  progressText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 8,
  },

  /* Stats */
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 16,
  },

  /* Controls */
  controls: {
    alignItems: 'center',
    marginVertical: 8,
    width: '100%',
  },
  testButton: {
    backgroundColor: '#667eea',
    paddingVertical: 15,
    paddingHorizontal: 44,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginBottom: 14,
  },
  stopButton: {
    backgroundColor: '#dc3545',
    shadowColor: '#dc3545',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bgButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  bgButtonActive: {
    backgroundColor: '#28a745',
  },
  bgButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bgButtonTextActive: {
    color: '#fff',
  },
  intervalBox: {
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
  intervalBtn: {
    backgroundColor: '#667eea',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    minWidth: 68,
    alignItems: 'center',
  },
  intervalBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default SpeedTestScreen;
