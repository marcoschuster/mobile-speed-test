import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../utils/theme';

interface LegalSection {
  key: string;
  title: string;
  body: string;
}

interface LegalModalProps {
  visible: boolean;
  selectedKey: string;
  sections: LegalSection[];
  onClose: () => void;
  onSelect: (key: string) => void;
}

const LegalModal = ({ visible, selectedKey, sections, onClose, onSelect }: LegalModalProps) => {
  const { t } = useTheme();
  const active = sections.find((section) => section.key === selectedKey) || sections[0];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: t.surfaceElevated, borderColor: t.glassBorder }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.textPrimary }]}>{active?.title || 'Legal'}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={[styles.close, { color: t.accent }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {sections.map((section) => {
              const selected = section.key === selectedKey;
              return (
                <TouchableOpacity
                  key={section.key}
                  onPress={() => onSelect(section.key)}
                  activeOpacity={0.7}
                  style={[
                    styles.tab,
                    { borderColor: t.glassBorder },
                    selected && { backgroundColor: t.accentTintSelected, borderColor: t.accent },
                  ]}
                >
                  <Text style={[styles.tabText, { color: selected ? t.accent : t.textSecondary }]}>{section.title}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.body}>
            <Text style={[styles.bodyText, { color: t.textSecondary }]}>{active?.body || ''}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  close: {
    fontSize: 14,
    fontWeight: '700',
  },
  tabs: {
    gap: 10,
    paddingBottom: 16,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    maxHeight: '100%',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    paddingBottom: 12,
  },
});

export default LegalModal;
