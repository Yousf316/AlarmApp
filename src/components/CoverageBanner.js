import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {formatCoverage} from '../core/time/format';

/**
 * How far ahead the alarms are registered: "المنبهات مجدولة حتى الخميس 12 نوفمبر
 * (6 أيام)", in a warning colour when less than two days are left.
 * `status` is what scheduleStore.loadStatus() returns.
 */
export default function CoverageBanner({status}) {
  if (!status) {
    return null;
  }
  const coverage =
    status.coverageUntil != null
      ? formatCoverage({coverageUntil: status.coverageUntil, tz: status.tz})
      : null;

  if (!coverage && status.blocked) {
    return (
      <View style={[styles.box, styles.warn]} testID="coverage-banner">
        <Text style={[styles.text, styles.warnText]}>
          لا توجد أماكن كافية لجدولة المنبهات الآن بسبب كثرة الغفوات المعلقة.
        </Text>
      </View>
    );
  }
  if (!coverage) {
    return null;
  }
  return (
    <View style={[styles.box, coverage.warn && styles.warn]} testID="coverage-banner">
      <Text style={[styles.text, coverage.warn && styles.warnText]}>
        {coverage.warn ? `⚠️ ${coverage.text}، افتح التطبيق لتجديدها.` : coverage.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#e8f3ff',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  warn: {backgroundColor: '#fff3cd'},
  text: {color: '#1b4f8a', fontSize: 14, textAlign: 'center'},
  warnText: {color: '#8a6d00'},
});
