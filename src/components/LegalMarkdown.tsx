import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

// Renders the small markdown subset the policy editor uses (# / ## / ###
// headings, "- " bullets, **bold**, blank-line paragraphs) as React Native
// elements. Ported from frontend/src/components/LegalMarkdown.tsx -
// deliberately no HTML passthrough: policy text is admin-edited and must
// never become markup.

const EMAIL_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

function renderText(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(EMAIL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <Text
        key={`${keyPrefix}-${i}`}
        style={styles.emailLink}
        onPress={() => Linking.openURL(`mailto:${part}`)}
        testID={`${keyPrefix}-email`}
      >
        {part}
      </Text>
    ) : (
      <Text key={`${keyPrefix}-${i}`}>{part}</Text>
    )
  );
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <Text key={`${keyPrefix}-${i}`} style={styles.bold} testID={`${keyPrefix}-bold`}>
        {renderText(part.slice(2, -2), `${keyPrefix}-${i}`)}
      </Text>
    ) : (
      <Text key={`${keyPrefix}-${i}`}>{renderText(part, `${keyPrefix}-${i}`)}</Text>
    )
  );
}

export default function LegalMarkdown({ body, testID }: { body: string; testID?: string }) {
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      const k = `legal-block-${blocks.length}`;
      blocks.push(
        <Text key={k} style={styles.paragraph} testID={k}>
          {renderInline(paragraph.join(' '), k)}
        </Text>
      );
      paragraph = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      const k = `legal-block-${blocks.length}`;
      blocks.push(
        <View key={k} testID={k}>
          {bullets.map((b, i) => (
            <Text key={i} style={styles.bullet} testID={`${k}-item-${i}`}>
              {'• '}
              {renderInline(b, `${k}-${i}`)}
            </Text>
          ))}
        </View>
      );
      bullets = [];
    }
  };

  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (!line) {
      flushParagraph();
      flushBullets();
    } else if (heading) {
      flushParagraph();
      flushBullets();
      const k = `legal-block-${blocks.length}`;
      const level = heading[1].length;
      const headingStyle = level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3;
      blocks.push(
        <Text key={k} style={headingStyle} testID={k}>
          {renderInline(heading[2], k)}
        </Text>
      );
    } else if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      bullets.push(line.replace(/^[-*]\s+/, ''));
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();

  return <View testID={testID}>{blocks}</View>;
}

const styles = StyleSheet.create({
  paragraph: { fontSize: 13, lineHeight: 20, color: '#475569', marginBottom: 10 },
  bullet: { fontSize: 13, lineHeight: 20, color: '#475569', marginBottom: 6, marginStart: 4 },
  h1: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginTop: 14, marginBottom: 6 },
  h2: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 14, marginBottom: 6 },
  h3: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 10, marginBottom: 4 },
  bold: { fontWeight: '700', color: '#0F172A' },
  emailLink: { color: '#1D4ED8', textDecorationLine: 'underline' },
});
