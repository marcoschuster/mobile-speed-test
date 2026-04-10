import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FlashTitle from './FlashTitle';
import { COLORS, RADIUS, useTheme } from '../utils/theme';

const LegalModal = ({ visible, selectedKey, sections, onClose, onSelect }) => {
  const { t } = useTheme();

  if (!selectedKey) return null;

  const selectedSection = sections[selectedKey];

  return (
    <Modal
      animationType="slide"
      visible={visible}
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: t.surface }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.tint, { backgroundColor: t.mode === 'dark' ? 'rgba(245, 196, 0, 0.03)' : 'rgba(245, 196, 0, 0.015)' }]} />

          <View style={styles.header}>
            <FlashTitle text="LEGAL CENTER" size="small" interval={5000} />
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabRow}>
            {Object.entries(sections).map(([key, section]) => {
              const active = key === selectedKey;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => onSelect(key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {section.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionTitle, { color: t.textPrimary }]}>
              {selectedSection.title}
            </Text>
            {selectedSection.paragraphs.map((paragraph) => (
              <Text
                key={paragraph}
                style={[styles.paragraph, { color: t.textSecondary }]}
              >
                {paragraph}
              </Text>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingBottom: 16,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  closeText: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tab: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: COLORS.accent,
  },
  tabText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: COLORS.black,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
});

export default LegalModal;
