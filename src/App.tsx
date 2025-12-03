// src/App.tsx
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import LoginScreen from './screens/LoginScreen';
import MainScreen from './screens/MainScreen';
import PresentationSetupScreen from './screens/PresentationSetupScreen';
import TeleprompterScreen from './screens/TeleprompterScreen';
import EndPresentationModal from './screens/EndPresentationModal';
import AgendaTrackerScreen from './screens/AgendaTrackerScreen';
import MeetingSummaryScreen from './screens/MeetingSummaryScreen';

// 화면 타입
type ScreenType =
  | 'login'
  | 'main'
  | 'setup'
  | 'teleprompter'
  | 'end-modal'
  | 'agenda'
  | 'summary';

// 아젠다 노드 타입
export type AgendaItemType =
  | 'research'
  | 'idea'
  | 'design'
  | 'decision'
  | 'action'
  | 'general'
  | 'question'
  | 'negative'
  | 'positive'
  | '리서치'
  | '아이디어'
  | '개발'
  | '디자인'
  | '일반';

export interface AgendaItem {
  id: string;
  text: string;
  type: AgendaItemType;
  isRoot?: boolean;
}

// 아젠다 맵 데이터 타입
export interface AgendaNodeData {
  id: number;
  label: string;
  category: string;
  timestamp?: string;
  summary?: string;
  transcript?: string;
}

export interface AgendaEdgeData {
  from: number;
  to: number;
}

export interface AgendaMapData {
  nodes: AgendaNodeData[];
  edges: AgendaEdgeData[];
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('login');
  const [showEndModal, setShowEndModal] = useState(false);
  const [hasPresentation, setHasPresentation] = useState(false);

  // Presentation data state
  const [presentationTitle, setPresentationTitle] = useState('');
  const [presentationScript, setPresentationScript] = useState('');
  const [targetTimeSeconds, setTargetTimeSeconds] = useState(0);  
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);

  // 아젠다(논점 지도) 공통 상태
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);

  // 아젠다 맵 데이터 상태
  const [agendaMapData, setAgendaMapData] = useState<AgendaMapData>({
    nodes: [],
    edges: [],
  });

  // Supabase 인증 상태 관리
  useEffect(() => {
    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // 로그인된 상태면 main 화면으로
        if (currentScreen === 'login') {
          setCurrentScreen('main');
        }
      }
    });

    // 인증 상태 변경 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // 로그인 성공
        setCurrentScreen('main');
      } else {
        // 로그아웃
        setCurrentScreen('login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 메인으로 돌아갈 때 전체 상태 정리
  const navigateToMain = () => {
    setCurrentScreen('main');
    setShowEndModal(false);
    setHasPresentation(false);
    setPresentationTitle('');
    setPresentationScript('');
    setExtractedKeywords([]);
    setTargetTimeSeconds(0);
    setAgendaItems([]);
    setAgendaMapData({ nodes: [], edges: [] });
  };

  // Back navigation logic based on screen flow
  const handleBack = () => {
    switch (currentScreen) {
      case 'main':
        setCurrentScreen('login');
        break;
      case 'setup':
        setCurrentScreen('main');
        break;
      case 'teleprompter':
        setCurrentScreen('setup');
        break;
      case 'agenda':
        if (hasPresentation) {
          setCurrentScreen('teleprompter');
          setShowEndModal(true);
        } else {
          setCurrentScreen('main');
        }
        break;
      case 'summary':
        setCurrentScreen('agenda');
        break;
      default:
        break;
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onLogin={() => setCurrentScreen('main')} />;

      case 'main':
        return (
          <MainScreen
            onStartMeeting={() => {
              setHasPresentation(false);
              setPresentationTitle('');
              setPresentationScript('');
              setExtractedKeywords([]);
              setAgendaItems([]);
              setAgendaMapData({ nodes: [], edges: [] });
              setCurrentScreen('agenda');
            }}
            onStartPresentation={() => setCurrentScreen('setup')}
            onBack={handleBack}
          />
        );

      case 'setup':
        return (
          <PresentationSetupScreen
            onComplete={(title, script, targetTime) => {
              setPresentationTitle(title);
              setPresentationScript(script);
              setTargetTimeSeconds(targetTime);
              setCurrentScreen('teleprompter');
            }}
            onHomeClick={navigateToMain}
            onBack={handleBack}
          />
        );

      case 'teleprompter':
        return (
          <>
            <TeleprompterScreen
              presentationTitle={presentationTitle}
              script={presentationScript}
              onEnd={() => setShowEndModal(true)}
              onKeywordsExtracted={setExtractedKeywords}
              targetTimeSeconds={targetTimeSeconds}
              onHomeClick={navigateToMain}
              onBack={handleBack}
            />
            {showEndModal && (
              <EndPresentationModal
                onStartMeeting={() => {
                  setShowEndModal(false);
                  setHasPresentation(true);
                  setAgendaItems([]);
                  setAgendaMapData({ nodes: [], edges: [] });
                  setCurrentScreen('agenda');
                }}
                onFinish={() => {
                  setShowEndModal(false);
                  setCurrentScreen('main');
                }}
              />
            )}
          </>
        );

      case 'agenda':
        return (
          <AgendaTrackerScreen
            hasPresentation={hasPresentation}
            presentationTitle={presentationTitle}
            extractedKeywords={extractedKeywords}
            agendaItems={agendaItems}
            onAgendaItemsChange={setAgendaItems}
            agendaMapData={agendaMapData}
            onAgendaMapDataChange={setAgendaMapData}
            onEnd={() => setCurrentScreen('summary')}
            onHomeClick={navigateToMain}
            onBack={handleBack}
          />
        );

      case 'summary':
        return (
          <MeetingSummaryScreen
            agendaMapData={agendaMapData}
            onBackToMain={navigateToMain}
            onBack={handleBack}
          />
        );

      default:
        return <LoginScreen onLogin={() => setCurrentScreen('main')} />;
    }
  };

  return (
    <div className="w-full h-screen bg-[#F3F4F6]">
      <div className="h-full max-w-[1440px] mx-auto bg-white">
        {renderScreen()}
      </div>
    </div>
  );
}
