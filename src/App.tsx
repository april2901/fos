import { useState } from 'react';
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

// 아젠다 노드 타입 (AgendaNode.tsx 의 type 과 동일하게 맞춤)
export type AgendaItemType =
  | 'research'
  | 'idea'
  | 'design'
  | 'decision'
  | 'action'
  | 'general'
  | 'question'
  | 'negative'
  | 'positive';

export interface AgendaItem {
  id: string;          // 노드 고유 ID (UUID 또는 timestamp 등)
  text: string;        // 노드 텍스트
  type: AgendaItemType;
  isRoot?: boolean;    // 루트 노드 여부 (옵션)
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('login');
  const [showEndModal, setShowEndModal] = useState(false);
  const [hasPresentation, setHasPresentation] = useState(false);

  // Presentation data state
  const [presentationTitle, setPresentationTitle] = useState('');
  const [presentationScript, setPresentationScript] = useState('');
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);

  // 아젠다(논점 지도) 공통 상태
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);

  // 메인으로 돌아갈 때 전체 상태 정리
  const navigateToMain = () => {
    setCurrentScreen('main');
    setShowEndModal(false);
    setHasPresentation(false);
    setPresentationTitle('');
    setPresentationScript('');
    setExtractedKeywords([]);
    setAgendaItems([]); // 회의/아젠다 리셋
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
        // If coming from presentation, go back to teleprompter with modal
        if (hasPresentation) {
          setCurrentScreen('teleprompter');
          setShowEndModal(true);
        } else {
          // If standalone meeting, go to main
          setCurrentScreen('main');
        }
        break;
      case 'summary':
        // 요약 → 다시 논점 지도
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
              // 발표 없이 바로 회의 시작
              setHasPresentation(false);
              setPresentationTitle('');
              setPresentationScript('');
              setExtractedKeywords([]);
              setAgendaItems([]); // 새 회의이므로 아젠다 초기화
              setCurrentScreen('agenda');
            }}
            onStartPresentation={() => setCurrentScreen('setup')}
            onBack={handleBack}
          />
        );

      case 'setup':
        return (
          <PresentationSetupScreen
            onComplete={(title, script) => {
              setPresentationTitle(title);
              setPresentationScript(script);
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
              onHomeClick={navigateToMain}
              onBack={handleBack}
            />
            {showEndModal && (
              <EndPresentationModal
                onStartMeeting={() => {
                  // 발표 끝 → 회의로 전환
                  setShowEndModal(false);
                  setHasPresentation(true);
                  setAgendaItems([]); // 새 회의 시작이므로 아젠다 초기화
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
            onAgendaItemsChange={setAgendaItems} // 실시간 입력/노드 생성은 여기로
            onEnd={() => setCurrentScreen('summary')}
            onHomeClick={navigateToMain}
            onBack={handleBack}
          />
        );

      case 'summary':
        return (
          <MeetingSummaryScreen
            agendaItems={agendaItems}      // 논점 지도 결과를 요약 화면에서도 사용
            onBackToMain={navigateToMain}
            onBack={handleBack}
          />
        );

      default:
        return <LoginScreen onLogin={() => setCurrentScreen('main')} />;
    }
  };

  return (
    <div className="w-[1440px] h-[900px] mx-auto bg-white">
      {renderScreen()}
    </div>
  );
}
