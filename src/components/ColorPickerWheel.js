import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Text,
  ScrollView,
} from 'react-native';
import { COLOR_THEMES } from '../utils/theme';
import { useTheme } from '../utils/theme';
import SoundEngine from '../services/SoundEngine';

const ColorPickerWheel = ({ visible, onClose, onColorSelect, currentColorId }) => {
  const { t } = useTheme();

  const handleColorPress = (themeId) => {
    SoundEngine.playNavTick();
    onColorSelect(themeId);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          <Text style={[styles.title, { color: t.textPrimary }]}>Choose Accent Color</Text>
          
          <ScrollView
            style={styles.colorList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.colorListContent}
          >
            {COLOR_THEMES.map((theme) => (
              <TouchableOpacity
                key={theme.id}
                style={[
                  styles.colorOption,
                  { backgroundColor: theme.accent },
                  currentColorId === theme.id && styles.colorOptionActive,
                ]}
                onPress={() => handleColorPress(theme.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.colorName, { color: t.textPrimary }]}>
                  {theme.name}
                </Text>
                {currentColorId === theme.id && (
                  <View style={styles.checkmark} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: t.surface }]}
            onPress={onClose}
          >
            <Text style={[styles.closeText, { color: t.textPrimary }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  colorList: {
    flex: 1,
  },
  colorListContent: {
    gap: 12,
    paddingBottom: 20,
  },
  colorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionActive: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  colorName: {
    fontSize: 16,
    fontWeight: '600',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
    marginTop: 10,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default ColorPickerWheel;
