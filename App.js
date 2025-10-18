import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal as RNModal,
  ActivityIndicator,
  Alert,
  Animated,
  SectionList,
} from 'react-native';

// --- CONFIGURAÇÃO DA API ---
const FIREBASE_API_KEY = "AIzaSyAaD5U98Ie0H2I-JzA3Tfk806vMsQJQ-9I";
const FIREBASE_AUTH_BASE_URL = "https://identitytoolkit.googleapis.com/v1/accounts";
const COINUP_API_BASE_URL = "https://coinup.azurewebsites.net";

// --- SERVIÇO DA API ---
const apiService = {
  deleteQuest: async (questId, token) => {
    const response = await fetch(`${COINUP_API_BASE_URL}/api/app/Quest/deletar?questId=${questId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) { const errorText = await response.text(); throw new Error(`Erro ao deletar missão (Status: ${response.status}): ${errorText}`); }
    return { success: true };
  },
  getTransactions: async (token) => {
    const response = await fetch(`${COINUP_API_BASE_URL}/api/app/Transacao/listar-transacao`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) { const errorText = await response.text(); throw new Error(`Erro ao buscar transações (Status: ${response.status}): ${errorText}`); }
    return response.json();
  },
  getUserProfile: async (token) => {
    const response = await fetch(`${COINUP_API_BASE_URL}/api/app/Usuario/buscar-usuario`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) { const errorText = await response.text(); throw new Error(`Erro ao buscar perfil do usuário (Status: ${response.status}): ${errorText}`); }
    return response.json();
  },
  getQuestsByStatus: async (token, status) => {
    const response = await fetch(`${COINUP_API_BASE_URL}/api/app/Quest/buscar-quests?status=${status}`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) { 
      console.error(`Erro ao buscar missões com status ${status}: ${response.status}`);
      return [];
    }
    const quests = await response.json();
    return Array.isArray(quests) ? quests : [];
  },
  createQuest: async (questData, token) => {
    const response = await fetch(`${COINUP_API_BASE_URL}/api/app/Quest/criar-quest-manual`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(questData) });
    if (!response.ok) { const errorText = await response.text(); throw new Error(`Erro ao criar missão (Status: ${response.status}): ${errorText}`); }
    return { success: true };
  },
  firebaseLogin: async (email, password) => {
    const response = await fetch(`${FIREBASE_AUTH_BASE_URL}:signInWithPassword?key=${FIREBASE_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }), });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);
    return data;
  },
  coinUpLogin: async (email, password) => {
    const response = await fetch(`${COINUP_API_BASE_URL}/api/app/Auth/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`, { method: 'GET' });
    const responseText = await response.text();
    let data;
    try { data = JSON.parse(responseText); } catch (e) { throw new Error(`Erro de comunicação com o servidor: ${responseText}`); }
    if (!response.ok || data.statusCode !== 200) { throw new Error(data.message || 'Email ou senha inválidos na API CoinUp.'); }
    return data; 
  },
  createUserProfile: async (profileData) => {
    const response = await fetch(`${COINUP_API_BASE_URL}/api/app/Usuario/cadastro`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileData) });
    if (!response.ok) { const errorText = await response.text(); try { const errorJson = JSON.parse(errorText); throw new Error(errorJson.message || `Erro ao criar perfil: ${errorText}`); } catch (e) { throw new Error(`Erro ao criar perfil de usuário: ${errorText}`); } }
    return { success: true };
  },
  getDashboardData: async (token) => {
    const response = await fetch(`${COINUP_API_BASE_URL}/api/app/Conta/tela-home`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) { const errorText = await response.text(); throw new Error(`Não foi possível carregar os dados do dashboard (Status: ${response.status}): ${errorText}`); }
    return response.json();
  },
  createTransaction: async (transactionData, token) => {
    const response = await fetch(`${COINUP_API_BASE_URL}/api/app/Transacao/criar-transacao`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(transactionData) });
    if (!response.ok) { const errorText = await response.text(); throw new Error(`Erro ao criar transação: ${errorText}`); }
    return { success: true };
  },
};

// --- Ícones e Componentes de UI (Sem alterações) ---
const ProfileIcon = ({ onPress }) => ( <TouchableOpacity onPress={onPress} style={styles.iconButton}><View style={styles.iconCircle}><View style={[styles.iconShape, styles.profileHead]} /><View style={[styles.iconShape, styles.profileBody]} /></View></TouchableOpacity> );
const BackIcon = ({ onPress }) => ( <TouchableOpacity onPress={onPress} style={styles.backButton}><Text style={styles.backButtonText}>‹</Text></TouchableOpacity> );
const PasswordVisibilityToggle = ({ isVisible, onPress }) => ( <TouchableOpacity onPress={onPress} style={styles.passwordVisibilityButton}><Text style={styles.passwordVisibilityText}>{isVisible ? 'Ocultar' : 'Ver'}</Text></TouchableOpacity> );
const CalendarModal = ({ visible, onClose, onSelectDate }) => {
    const [date, setDate] = useState(new Date());
    const getMonthDays = (year, month) => { const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); let days = Array(firstDay).fill(null); for (let i = 1; i <= daysInMonth; i++) days.push(i); return days; };
    const days = getMonthDays(date.getFullYear(), date.getMonth());
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return ( <RNModal transparent={true} animationType="fade" visible={visible} onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>{monthNames[date.getMonth()]} {date.getFullYear()}</Text><View style={styles.calendarGrid}>{weekDays.map((day, index) => <Text key={index} style={styles.calendarWeekDay}>{day}</Text>)}{days.map((day, index) => ( <TouchableOpacity key={index} style={styles.calendarDay} onPress={() => day && onSelectDate(new Date(date.getFullYear(), date.getMonth(), day))}><Text style={day ? styles.calendarDayText : {}}>{day}</Text></TouchableOpacity> ))}</View><TouchableOpacity style={styles.modalCloseButton} onPress={onClose}><Text style={styles.modalCloseButtonText}>Fechar</Text></TouchableOpacity></View></View></RNModal> );
};
const SelectionModal = ({ visible, title, options, onSelect, onClose }) => {
  if (!visible) return null;
  return ( <RNModal transparent={true} animationType="fade" visible={visible} onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>{title}</Text><ScrollView>{options.map((option, index) => ( <TouchableOpacity key={index} style={styles.modalOption} onPress={() => onSelect(option)}><Text style={styles.modalOptionText}>{option}</Text></TouchableOpacity> ))}</ScrollView><TouchableOpacity style={styles.modalCloseButton} onPress={onClose}><Text style={styles.modalCloseButtonText}>Fechar</Text></TouchableOpacity></View></View></RNModal> );
};
const AlertModal = ({ visible, title, message, onClose }) => ( <RNModal transparent visible={visible} animationType="fade" onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>{title}</Text><Text style={styles.alertMessage}>{message}</Text><TouchableOpacity style={styles.modalCloseButton} onPress={onClose}><Text style={styles.modalCloseButtonText}>OK</Text></TouchableOpacity></View></View></RNModal> );
const AnimatedProgressBar = ({ progress, color = '#3CB371' }) => {
    const animation = useRef(new Animated.Value(0)).current;
    useEffect(() => { Animated.timing(animation, { toValue: progress, duration: 500, useNativeDriver: false }).start(); }, [progress]);
    const width = animation.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"], extrapolate: "clamp" });
    return (<View style={styles.progressBarBackground}><Animated.View style={[styles.progressBarFill, { width, backgroundColor: color }]} /></View>);
};
const AnimatedNumber = ({ value, suffix = '', style }) => {
    const animation = useRef(new Animated.Value(value || 0)).current;
    const [displayValue, setDisplayValue] = useState(value || 0);
    useEffect(() => {
        const listener = animation.addListener(({ value }) => setDisplayValue(value));
        Animated.timing(animation, { toValue: value || 0, duration: 300, useNativeDriver: false }).start();
        return () => animation.removeListener(listener);
    }, [value]);
    return <Animated.Text style={style}>{displayValue.toFixed(0)}{suffix}</Animated.Text>;
};

// --- Telas (Login, SignUp, etc. sem alterações) ---
const LoginScreen = ({ onNavigate, onLoginSuccess }) => {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [isPasswordVisible, setIsPasswordVisible] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(null);
  const handleLogin = async () => { if (!email.trim() || !password.trim()) { setError("Por favor, preencha o email e a senha."); return; } if (loading) return; setLoading(true); setError(null); try { const firebaseData = await apiService.firebaseLogin(email, password); const coinUpData = await apiService.coinUpLogin(email, password); onLoginSuccess({ firebaseData, coinUpData }); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  return ( <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}><AlertModal visible={!!error} title="Erro de Login" message={error} onClose={() => setError(null)} /><View style={styles.content}><Text style={[styles.title, {marginBottom: 60}]}>Bem vindo ao CoinUP</Text><Text style={styles.subtitle}>Faça login para gerenciar sua carteira</Text><View style={styles.inputContainer}><TextInput style={styles.inputField} placeholder="Email" placeholderTextColor="#999" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} /></View><View style={styles.inputContainer}><TextInput style={styles.inputField} placeholder="Senha" placeholderTextColor="#999" secureTextEntry={!isPasswordVisible} value={password} onChangeText={setPassword} /><PasswordVisibilityToggle isVisible={isPasswordVisible} onPress={() => setIsPasswordVisible(!isPasswordVisible)} /></View><TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}</TouchableOpacity><TouchableOpacity style={styles.linkButton} onPress={() => onNavigate('signup')}><Text style={styles.linkText}>Não tem uma conta? <Text style={styles.linkTextBold}>Cadastre-se</Text></Text></TouchableOpacity></View></KeyboardAvoidingView> );
};
const SignUpScreen = ({ onNavigate }) => {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [gender, setGender] = useState(null); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false); const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const [success, setSuccess] = useState(false);
  const getGenderEnum = () => { if (gender === 'male') return 1; if (gender === 'female') return 2; return 0; };
  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) { setError("Por favor, preencha todos os campos."); return; }
    if (password !== confirmPassword) { setError("As senhas não coincidem."); return; }
    if (loading) return; setLoading(true); setError(null);
    try {
      const profileData = { nome: name, email, senha: password, telefone: phone, sexo: getGenderEnum() };
      await apiService.createUserProfile(profileData);
      setSuccess(true);
    } catch (e) {
      if (e.message && (e.message.includes('Erro ao criar perfil de usuário') || e.message.includes("Unexpected token"))) { setSuccess(true); } else { setError(e.message); }
    } finally { setLoading(false); }
  };
  return ( <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}><AlertModal visible={!!error} title="Erro no Cadastro" message={error} onClose={() => setError(null)} /><AlertModal visible={success} title="Sucesso!" message="Sua conta foi criada. Você já pode fazer o login." onClose={() => { setSuccess(false); onNavigate('login'); }} /><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>Crie sua conta</Text><Text style={styles.subtitle}>É rápido e fácil</Text><View style={styles.inputContainer}><TextInput style={styles.inputField} placeholder="Nome Completo" placeholderTextColor="#999" value={name} onChangeText={setName} /></View><View style={styles.inputContainer}><TextInput style={styles.inputField} placeholder="Email" placeholderTextColor="#999" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} /></View><View style={styles.inputContainer}><TextInput style={styles.inputField} placeholder="Telefone" placeholderTextColor="#999" keyboardType="phone-pad" value={phone} onChangeText={setPhone} /></View><View style={styles.genderContainer}><Text style={styles.genderLabel}>Sexo:</Text><TouchableOpacity style={[styles.genderButton, gender === 'male' && styles.genderButtonSelected]} onPress={() => setGender('male')}><Text style={[styles.genderButtonText, gender === 'male' && styles.genderButtonTextSelected]}>Masculino</Text></TouchableOpacity><TouchableOpacity style={[styles.genderButton, gender === 'female' && styles.genderButtonSelected]} onPress={() => setGender('female')}><Text style={[styles.genderButtonText, gender === 'female' && styles.genderButtonTextSelected]}>Feminino</Text></TouchableOpacity></View><View style={styles.inputContainer}><TextInput style={styles.inputField} placeholder="Senha" placeholderTextColor="#999" secureTextEntry={!isPasswordVisible} value={password} onChangeText={setPassword} /><PasswordVisibilityToggle isVisible={isPasswordVisible} onPress={() => setIsPasswordVisible(!isPasswordVisible)} /></View><View style={styles.inputContainer}><TextInput style={styles.inputField} placeholder="Confirmar Senha" placeholderTextColor="#999" secureTextEntry={!isConfirmPasswordVisible} value={confirmPassword} onChangeText={setConfirmPassword} /><PasswordVisibilityToggle isVisible={isConfirmPasswordVisible} onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)} /></View><TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Cadastrar</Text>}</TouchableOpacity><TouchableOpacity style={styles.linkButton} onPress={() => onNavigate('login')}><Text style={styles.linkText}> Já tem uma conta? <Text style={styles.linkTextBold}>Faça Login</Text></Text></TouchableOpacity></ScrollView></KeyboardAvoidingView> );
};
const HomeScreen = ({ onNavigate, missions, dashboardData, isLoading, dashboardError }) => {
    const [isTransactionTypeModalVisible, setTransactionTypeModalVisible] = useState(false);
    const transactionTypeOptions = [{ label: 'Nova Receita', action: () => onNavigate('addIncome') }, { label: 'Nova Despesa', action: () => onNavigate('addExpense') }];
    if (isLoading) { return ( <View style={styles.centeredMessageContainer}><ActivityIndicator size="large" color="#3CB371" /></View> ); }
    if (dashboardError) { return ( <View style={styles.centeredMessageContainer}><Text style={styles.errorMessage}>{dashboardError}</Text></View> ); }
    const { receita, despesa, conta } = dashboardData || {};
    return ( <View style={styles.container}><SelectionModal visible={isTransactionTypeModalVisible} title="O que deseja criar?" options={transactionTypeOptions.map(o => o.label)} onSelect={(optionLabel) => { const selected = transactionTypeOptions.find(o => o.label === optionLabel); if (selected) selected.action(); setTransactionTypeModalVisible(false); }} onClose={() => setTransactionTypeModalVisible(false)} /><ScrollView style={styles.homeContainer}>
        <View style={styles.header}><View style={{ width: 50 }} /><Text style={styles.pageTitle}>{conta?.nome || 'Carteira'}</Text><View style={styles.headerIcons}><ProfileIcon onPress={() => onNavigate('profile')} /></View></View>
        <TouchableOpacity onPress={() => onNavigate('history')}>
            <View style={styles.balanceCard}><Text style={styles.balanceCardTitle}>Saldo Atual</Text><Text style={styles.balanceCardAmount}>R$ {conta?.saldoAtual?.toFixed(2).replace('.', ',') || '0,00'}</Text></View>
        </TouchableOpacity>
        <View style={styles.summaryContainer}><TouchableOpacity style={[styles.summaryCard, { backgroundColor: '#E6F5EC' }]} onPress={() => onNavigate('addIncome')}><Text style={styles.summaryCardTitle}>Receitas</Text><Text style={[styles.summaryCardAmount, { color: '#3CB371' }]}>R$ {receita?.toFixed(2).replace('.', ',') || '0,00'}</Text></TouchableOpacity><TouchableOpacity style={[styles.summaryCard, { backgroundColor: '#FEECEE' }]} onPress={() => onNavigate('addExpense')}><Text style={styles.summaryCardTitle}>Despesas</Text><Text style={[styles.summaryCardAmount, { color: '#E53E3E' }]}>R$ {despesa?.toFixed(2).replace('.', ',') || '0,00'}</Text></TouchableOpacity></View>
        <TouchableOpacity style={styles.missionsCard} onPress={() => onNavigate('missions')}><View style={styles.missionsCardHeader}><Text style={styles.missionsCardTitle}>Missões Ativas</Text><Text style={styles.missionsViewMore}>Ver mais &gt;</Text></View><View style={styles.separator} />{missions && missions.length > 0 ? missions.slice(0, 4).map((mission, index) => { const progress = mission.progressoAtual || 0; return ( <View key={mission.id} style={[styles.missionItem, index === missions.slice(0, 4).length - 1 ? { marginBottom: 0 } : {}]}>
      <View><Text>{mission.descricao}</Text><Text style={styles.missionXpText}>+ {mission.pontosDeExperiencia} XP</Text></View>
      <View style={styles.missionProgressContainer}><Text style={styles.missionProgress}>Progresso: </Text><AnimatedNumber value={progress} suffix="%" style={styles.missionProgress} /></View>
      </View> );}) : <Text style={{paddingVertical: 10}}>Nenhuma missão ativa.</Text>}</TouchableOpacity></ScrollView></View> );
};
const MissionsScreen = ({ onNavigate, missions, onDelete }) => {
    const [activeTab, setActiveTab] = useState('ativas');
    const handleDelete = (missionId) => { Alert.alert( "Confirmar Exclusão", "Você tem certeza que quer deletar esta missão?", [ { text: "Cancelar", style: "cancel" }, { text: "Deletar", onPress: () => onDelete(missionId), style: "destructive" } ] ); };
    const renderMissionItem = (mission) => {
        const status = mission.status;
        let statusInfo = { icon: '⏳', color: '#3CB371', label: 'Em andamento' };
        if (status === 1) { statusInfo = { icon: '✅', color: '#28a745', label: 'Concluída!' }; }
        else if (status === 2) { statusInfo = { icon: '❌', color: '#dc3545', label: 'Falhou' }; }
        else if (status === 3) { statusInfo = { icon: '⌛', color: '#6c757d', label: 'Expirada' }; }
        const progress = mission.progressoAtual ?? 0;
        return (
            <View key={mission.id} style={styles.missionListItem}>
                <Text style={styles.missionStatusIcon}>{statusInfo.icon}</Text>
                <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text style={styles.missionListTitle}>{mission.descricao}</Text>
                    <View style={{ marginVertical: 8 }}><AnimatedProgressBar progress={progress} color={statusInfo.color} /></View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.missionXpText, {fontSize: 14}]}>Recompensa: +{mission.pontosDeExperiencia} XP</Text>
                      <Text style={{ fontSize: 12, color: statusInfo.color, fontWeight: 'bold' }}>{statusInfo.label}</Text>
                    </View>
                </View>
                {status === 0 && (<TouchableOpacity onPress={() => handleDelete(mission.id)} style={styles.deleteButton}><Text style={styles.deleteButtonText}>🗑️</Text></TouchableOpacity>)}
            </View>
        );
    };
    const missionLists = { ativas: missions.ativas || [], concluidas: missions.concluidas || [], arquivadas: missions.arquivadas || [] };
    const currentList = missionLists[activeTab];
    return (
        <View style={styles.pageContainer}>
            <View style={styles.pageHeader}><BackIcon onPress={() => onNavigate('home')} /><Text style={styles.pageTitle}>Minhas Missões</Text><View style={{ width: 50 }} /></View>
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === 'ativas' && styles.tabActive]} onPress={() => setActiveTab('ativas')}><Text style={[styles.tabText, activeTab === 'ativas' && styles.tabTextActive]}>Ativas</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'concluidas' && styles.tabActive]} onPress={() => setActiveTab('concluidas')}><Text style={[styles.tabText, activeTab === 'concluidas' && styles.tabTextActive]}>Concluídas</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'arquivadas' && styles.tabActive]} onPress={() => setActiveTab('arquivadas')}><Text style={[styles.tabText, activeTab === 'arquivadas' && styles.tabTextActive]}>Arquivadas</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.formContainer}>{currentList.length > 0 ? currentList.map(mission => renderMissionItem(mission)) : <Text style={styles.emptyMessage}>Nenhuma missão nesta categoria.</Text>}</ScrollView>
            <View style={styles.bottomButtonContainer}><TouchableOpacity style={styles.button} onPress={() => onNavigate('createMission')}><Text style={styles.buttonText}>Criar Nova Missão</Text></TouchableOpacity></View>
        </View>
    );
};
const CreateMissionScreen = ({ onNavigate, onSave }) => {
    const [descricao, setDescricao] = useState(''); const [rawValue, setRawValue] = useState(''); const [tipoDeObjetivo, setTipoDeObjetivo] = useState(1); const [duracao, setDuracao] = useState(0); const [categoriaAlvo, setCategoriaAlvo] = useState(4);
    const [modalVisible, setModalVisible] = useState(false); const [modalConfig, setModalConfig] = useState({ title: '', options: [], onSelect: () => {} });
    const [loading, setLoading] = useState(false); const [error, setError] = useState(null);
    const objectiveTypeMap = { 'Limitar Gasto em Categoria': 1, 'Não Gastar em Categoria': 2, 'Manter Saldo Acima de': 3 };
    const durationMap = { 'Diária': 0, 'Semanal': 1, 'Mensal': 2 };
    
    // ===== ALTERAÇÃO ÚNICA AQUI: Mapa de categorias de despesa corrigido =====
    const expenseCategoryMap = { 'Alimentação': 4, 'Moradia': 3, 'Transporte': 5, 'Saúde': 6, 'Lazer e Hobbies': 7, 'Pix': 2, 'Outros': 0 };

    const formatCurrency = (value) => { if (!value) return ''; let num = value.replace(/[^\d]/g, ''); if (num.length === 0) return ''; num = parseInt(num, 10).toString(); if (num.length < 3) num = num.padStart(3, '0'); return 'R$ ' + num.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ',' + num.slice(-2); }; const handleValueChange = (text) => setRawValue(text.replace(/[^\d]/g, ''));
    const openModal = (type) => {
        let config = {};
        if (type === 'objective') { config = { title: 'Tipo de Objetivo', options: Object.keys(objectiveTypeMap), onSelect: (option) => setTipoDeObjetivo(objectiveTypeMap[option]) }; }
        else if (type === 'duration') { config = { title: 'Duração', options: Object.keys(durationMap), onSelect: (option) => setDuracao(durationMap[option]) }; }
        else if (type === 'category') { config = { title: 'Categoria Alvo', options: Object.keys(expenseCategoryMap), onSelect: (option) => setCategoriaAlvo(expenseCategoryMap[option]) }; }
        setModalConfig(config); setModalVisible(true);
    };
    const handleSave = async () => { 
      if (!descricao.trim()) { setError("Preencha a descrição."); return; }
      if ((tipoDeObjetivo === 1 || tipoDeObjetivo === 3) && !rawValue) { setError("Preencha o valor alvo."); return; }
      setLoading(true); setError(null); 
      try { 
        const valorFinal = (tipoDeObjetivo === 2) ? 0 : parseFloat(rawValue) / 100;
        const newMissionData = { descricao, valorAlvo: valorFinal, tipoDeObjetivo, duracao, categoriaAlvo }; 
        await onSave(newMissionData); 
      } catch (e) { setError(e.message); } finally { setLoading(false); } 
    };
    const showValueField = tipoDeObjetivo === 1 || tipoDeObjetivo === 3;
    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.pageContainer}>
            <AlertModal visible={!!error} title="Erro" message={error} onClose={() => setError(null)} />
            <SelectionModal visible={modalVisible} title={modalConfig.title} options={modalConfig.options} onSelect={(opt) => { modalConfig.onSelect(opt); setModalVisible(false); }} onClose={() => setModalVisible(false)} />
            <View style={styles.pageHeader}><BackIcon onPress={() => onNavigate('missions')} /><Text style={styles.pageTitle}>Nova Missão</Text><View style={{ width: 50 }} /></View>
            <ScrollView contentContainerStyle={styles.formContainer}>
                <View style={styles.formRow}><Text style={styles.formLabel}>Descrição</Text><TextInput style={styles.formInput} placeholder="Ex: Gastar menos de R$50 com Lazer" placeholderTextColor="#ccc" value={descricao} onChangeText={setDescricao} /></View>
                <TouchableOpacity style={styles.formRow} onPress={() => openModal('objective')}><Text style={styles.formLabel}>Tipo de Objetivo</Text><Text style={styles.formInput}>{Object.keys(objectiveTypeMap).find(key => objectiveTypeMap[key] === tipoDeObjetivo)}</Text></TouchableOpacity>
                <TouchableOpacity style={styles.formRow} onPress={() => openModal('duration')}><Text style={styles.formLabel}>Duração</Text><Text style={styles.formInput}>{Object.keys(durationMap).find(key => durationMap[key] === duracao)}</Text></TouchableOpacity>
                {(tipoDeObjetivo === 1 || tipoDeObjetivo === 2) && (<TouchableOpacity style={styles.formRow} onPress={() => openModal('category')}><Text style={styles.formLabel}>Categoria Alvo</Text><Text style={styles.formInput}>{Object.keys(expenseCategoryMap).find(key => expenseCategoryMap[key] === categoriaAlvo)}</Text></TouchableOpacity>)}
                {showValueField && (<View style={styles.formRow}><Text style={styles.formLabel}>Valor Alvo</Text><TextInput style={styles.formInput} placeholder="R$ 0,00" keyboardType="numeric" value={formatCurrency(rawValue)} onChangeText={handleValueChange} /></View>)}
            </ScrollView>
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}><TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleSave} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Salvar Missão</Text>}</TouchableOpacity></View>
        </KeyboardAvoidingView>
    );
};
const AddIncomeScreen = ({ onNavigate, userToken, onSaveSuccess, dashboardData }) => {
    const [rawValue, setRawValue] = useState(''); const [date, setDate] = useState(new Date()); const [description, setDescription] = useState('');
    const incomeCategoryMap = { 'Salário': 1, 'Pix': 2, 'Cheque': 8, 'Dinheiro': 9, 'Outros': 0 };
    const categoryOptions = Object.keys(incomeCategoryMap);
    const [category, setCategory] = useState('Salário');
    const [isCategoryModalVisible, setCategoryModalVisible] = useState(false); const [isCalendarVisible, setCalendarVisible] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const descriptionInputRef = useRef(null);
    const formatCurrency = (value) => { if (!value) return ''; let num = value.replace(/[^\d]/g, ''); if (num.length === 0) return ''; num = parseInt(num, 10).toString(); if (num.length < 3) num = num.padStart(3, '0'); return 'R$ ' + num.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ',' + num.slice(-2); };
    const handleValueChange = (text) => setRawValue(text.replace(/[^\d]/g, ''));
    const handleDateSelect = (selectedDate) => { setDate(selectedDate); setCalendarVisible(false); };
    const handleSave = async () => {
        if (!rawValue) { setError("Por favor, insira um valor."); return; }
        if (!dashboardData?.conta?.id) { setError("Não foi possível identificar a conta do usuário."); return; }
        setLoading(true); setError(null);
        try {
            const valorNumerico = parseFloat(rawValue) / 100;
            if (isNaN(valorNumerico) || valorNumerico <= 0) { setError("O valor inserido é inválido."); setLoading(false); return; }
            const adjustedDate = new Date(date);
            adjustedDate.setHours(12, 0, 0, 0);
            const transactionData = { tipoTransacao: 1, categoria: incomeCategoryMap[category], valor: valorNumerico, descricao: description, data: adjustedDate.toISOString() };
            await apiService.createTransaction(transactionData, userToken);
            onSaveSuccess();
        } catch (e) { setError(`Ocorreu um erro: ${e.message}`); } finally { setLoading(false); }
    };
    return ( <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.pageContainer}><AlertModal visible={!!error} title="Erro" message={error} onClose={() => setError(null)} /><CalendarModal visible={isCalendarVisible} onClose={() => setCalendarVisible(false)} onSelectDate={handleDateSelect} /><SelectionModal visible={isCategoryModalVisible} title="Selecione uma Categoria" options={categoryOptions} onSelect={(opt) => { setCategory(opt); setCategoryModalVisible(false); }} onClose={() => setCategoryModalVisible(false)} /><View style={styles.pageHeader}><BackIcon onPress={() => onNavigate('home')} /><Text style={styles.pageTitle}>Nova Receita</Text><View style={{ width: 50 }} /></View><ScrollView contentContainerStyle={styles.formScrollContainer}><View><Text style={styles.formValueLabel}>Valor da receita</Text><TextInput style={styles.formValueInput} placeholder="R$ 0,00" placeholderTextColor="#ccc" keyboardType="numeric" value={formatCurrency(rawValue)} onChangeText={handleValueChange} /><TouchableOpacity style={styles.formRow} onPress={() => setCalendarVisible(true)}><Text style={styles.formLabel}>🗓️ Data</Text><Text style={styles.formInput}>{date.toLocaleDateString('pt-BR')}</Text></TouchableOpacity><TouchableOpacity style={styles.formRow} onPress={() => descriptionInputRef.current && descriptionInputRef.current.focus()}><Text style={styles.formLabel}>✍️ Descrição</Text><TextInput ref={descriptionInputRef} style={styles.formInput} placeholder="Ex: Salário do mês" placeholderTextColor="#ccc" value={description} onChangeText={setDescription} /></TouchableOpacity><TouchableOpacity style={styles.formRow} onPress={() => setCategoryModalVisible(true)}><Text style={styles.formLabel}>📂 Categoria</Text><Text style={styles.formInput}>{category}</Text></TouchableOpacity></View><TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleSave} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Salvar Receita</Text>}</TouchableOpacity></ScrollView></KeyboardAvoidingView> );
};

const AddExpenseScreen = ({ onNavigate, userToken, onSaveSuccess, dashboardData }) => {
    const [rawValue, setRawValue] = useState(''); const [date, setDate] = useState(new Date()); const [description, setDescription] = useState('');
    
    // ===== ALTERAÇÃO ÚNICA AQUI: Mapa de categorias de despesa corrigido =====
    const expenseCategoryMap = { 'Alimentação': 4, 'Moradia': 3, 'Transporte': 5, 'Saúde': 6, 'Lazer e Hobbies': 7, 'Pix': 2, 'Outros': 0 };
    
    const categoryOptions = Object.keys(expenseCategoryMap);
    const [category, setCategory] = useState('Alimentação');
    const [isCategoryModalVisible, setCategoryModalVisible] = useState(false); const [isCalendarVisible, setCalendarVisible] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const descriptionInputRef = useRef(null);
    const formatCurrency = (value) => { if (!value) return ''; let num = value.replace(/[^\d]/g, ''); if (num.length === 0) return ''; num = parseInt(num, 10).toString(); if (num.length < 3) num = num.padStart(3, '0'); return 'R$ ' + num.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ',' + num.slice(-2); };
    const handleValueChange = (text) => setRawValue(text.replace(/[^\d]/g, ''));
    const handleDateSelect = (selectedDate) => { setDate(selectedDate); setCalendarVisible(false); };
    const handleSave = async () => {
        if (!rawValue) { setError("Por favor, insira um valor."); return; }
        if (!dashboardData?.conta?.id) { setError("Não foi possível identificar a conta do usuário."); return; }
        setLoading(true); setError(null);
        try {
            const valorNumerico = parseFloat(rawValue) / 100;
            if (isNaN(valorNumerico) || valorNumerico <= 0) { setError("O valor inserido é inválido."); setLoading(false); return; }
            const adjustedDate = new Date(date);
            adjustedDate.setHours(12, 0, 0, 0);
            const transactionData = { tipoTransacao: 0, categoria: expenseCategoryMap[category], valor: valorNumerico, descricao: description, data: adjustedDate.toISOString() };
            await apiService.createTransaction(transactionData, userToken);
            onSaveSuccess();
        } catch (e) { setError(`Ocorreu um erro: ${e.message}`); } finally { setLoading(false); }
    };
    return ( <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.pageContainer}><AlertModal visible={!!error} title="Erro" message={error} onClose={() => setError(null)} /><CalendarModal visible={isCalendarVisible} onClose={() => setCalendarVisible(false)} onSelectDate={handleDateSelect} /><SelectionModal visible={isCategoryModalVisible} title="Selecione uma Categoria" options={categoryOptions} onSelect={(opt) => { setCategory(opt); setCategoryModalVisible(false); }} onClose={() => setCategoryModalVisible(false)} /><View style={styles.pageHeader}><BackIcon onPress={() => onNavigate('home')} /><Text style={styles.pageTitle}>Nova Despesa</Text><View style={{ width: 50 }} /></View><ScrollView contentContainerStyle={styles.formScrollContainer}><View><Text style={[styles.formValueLabel, { color: '#E53E3E' }]}>Valor da despesa</Text><TextInput style={[styles.formValueInput, { color: '#E53E3E' }]} placeholder="R$ 0,00" placeholderTextColor="#ccc" keyboardType="numeric" value={formatCurrency(rawValue)} onChangeText={handleValueChange} /><TouchableOpacity style={styles.formRow} onPress={() => setCalendarVisible(true)}><Text style={styles.formLabel}>🗓️ Data</Text><Text style={styles.formInput}>{date.toLocaleDateString('pt-BR')}</Text></TouchableOpacity><TouchableOpacity style={styles.formRow} onPress={() => descriptionInputRef.current && descriptionInputRef.current.focus()}><Text style={styles.formLabel}>✍️ Descrição</Text><TextInput ref={descriptionInputRef} style={styles.formInput} placeholder="Ex: Almoço" placeholderTextColor="#ccc" value={description} onChangeText={setDescription} /></TouchableOpacity><TouchableOpacity style={styles.formRow} onPress={() => setCategoryModalVisible(true)}><Text style={styles.formLabel}>📂 Categoria</Text><Text style={styles.formInput}>{category}</Text></TouchableOpacity></View><TouchableOpacity style={[styles.button, styles.confirmButton, { backgroundColor: '#E53E3E' }]} onPress={handleSave} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Salvar Despesa</Text>}</TouchableOpacity></ScrollView></KeyboardAvoidingView> );
};

// --- Telas (Profile, Achievements, etc. sem alterações) ---
const ProfileScreen = ({ onNavigate, onLogout, userProfile, isLoading }) => {
    const rankMap = { 0: 'Nenhum', 1: 'Cobre', 2: 'Bronze', 3: 'Prata', 4: 'Ouro', 5: 'Platina', 6: 'Diamante', 7: 'Lendário' };
    const sexoMap = { 0: 'Não informado', 1: 'Masculino', 2: 'Feminino' };
    if (isLoading || !userProfile) { return ( <View style={styles.centeredMessageContainer}><ActivityIndicator size="large" color="#3CB371" /></View> ); }
    const xpParaProximoNivel = 1000;
    const xpAtualNoNivel = userProfile.pontosDeExperiencia % xpParaProximoNivel;
    const xpProgresso = (xpAtualNoNivel / xpParaProximoNivel) * 100;
    return (
        <View style={styles.pageContainer}>
            <View style={styles.pageHeader}><BackIcon onPress={() => onNavigate('home')} /><Text style={styles.pageTitle}>Perfil</Text><View style={{ width: 50 }} /></View>
            <ScrollView contentContainerStyle={styles.profileContent}>
                <View style={styles.profileHeader}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{userProfile.nome ? userProfile.nome.charAt(0).toUpperCase() : 'U'}</Text></View><Text style={styles.profileName}>{userProfile.nome}</Text><Text style={styles.profileEmail}>{userProfile.email}</Text></View>
                <View style={styles.profileStatsCard}><Text style={styles.profileLevelRank}>{`Nível ${userProfile.nivel} - ${rankMap[userProfile.rank]}`}</Text><View style={{width: '100%', marginTop: 10}}><AnimatedProgressBar progress={xpProgresso} /><Text style={styles.xpLabel}>{`${xpAtualNoNivel} / ${xpParaProximoNivel} XP`}</Text></View></View>
                <View style={styles.profileStatsCard}><Text style={styles.cardTitle}>Informações</Text><View style={styles.infoRow}><Text style={styles.infoLabel}>Telefone:</Text><Text style={styles.infoValue}>{userProfile.telefone}</Text></View><View style={[styles.infoRow, { borderBottomWidth: 0 }]}><Text style={styles.infoLabel}>Sexo:</Text><Text style={styles.infoValue}>{sexoMap[userProfile.sexo]}</Text></View></View>
                <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => onNavigate('achievements')}><Text style={[styles.buttonText, styles.secondaryButtonText]}>Ver Conquistas</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.button, { marginTop: 20, backgroundColor: '#E53E3E' }]} onPress={onLogout}><Text style={styles.buttonText}>Sair da Conta</Text></TouchableOpacity>
            </ScrollView>
        </View>
    );
};
const AchievementsScreen = ({ onNavigate, userProfile }) => {
    const achievements = [ { name: 'Cobre', rankValue: 1, icon: '🥉' }, { name: 'Bronze', rankValue: 2, icon: '🥉' }, { name: 'Prata', rankValue: 3, icon: '🥈' }, { name: 'Ouro', rankValue: 4, icon: '🥇' }, { name: 'Platina', rankValue: 5, icon: '💎' }, { name: 'Diamante', rankValue: 6, icon: '💎' }, { name: 'Lendário', rankValue: 7, icon: '🏆' }, ];
    if (!userProfile) { return <View style={styles.centeredMessageContainer}><ActivityIndicator size="large" color="#3CB371" /></View>; }
    return (
        <View style={styles.pageContainer}>
            <View style={styles.pageHeader}><BackIcon onPress={() => onNavigate('profile')} /><Text style={styles.pageTitle}>Conquistas</Text><View style={{ width: 50 }} /></View>
            <ScrollView contentContainerStyle={styles.formContainer}><View style={styles.achievementsGrid}>{achievements.map((ach) => { const isUnlocked = userProfile.rank >= ach.rankValue; return ( <View key={ach.name} style={[styles.achievementBadge, !isUnlocked && styles.lockedBadge]}><Text style={styles.achievementIcon}>{ach.icon}</Text><Text style={styles.achievementName}>{ach.name}</Text></View> ); })}</View></ScrollView>
        </View>
    );
};
const TransactionHistoryScreen = ({ onNavigate, transactions }) => {
    const categoryMap = { 0: 'Outros', 1: 'Salário', 2: 'Pix', 3: 'Moradia', 4: 'Alimentação', 5: 'Transporte', 6: 'Saúde', 7: 'Lazer e Hobbies', 8: 'Cheque', 9: 'Dinheiro' };
    const renderTransactionItem = ({ item }) => {
        const tipoTransacao = item.TipoTransacao ?? item.tipoTransacao;
        const categoria = item.Categoria ?? item.categoria;
        const descricao = item.Descricao ?? item.descricao;
        const valor = item.Valor ?? item.valor ?? 0;
        const isIncome = tipoTransacao === 1;
        const color = isIncome ? '#28a745' : '#dc3545';
        const sign = isIncome ? '+ ' : '- ';
        return (
            <View style={historyStyles.card}>
                <View style={historyStyles.cardDetails}>
                    <Text style={historyStyles.cardTitle}>{categoryMap[categoria] || 'Sem Categoria'}</Text>
                    {descricao ? (<Text style={historyStyles.cardDescription}>{descricao}</Text>) : null}
                </View>
                <Text style={[historyStyles.cardAmount, { color }]}>{sign}R$ {valor.toFixed(2).replace('.', ',')}</Text>
            </View>
        );
    };
    const renderDateHeader = ({ section: { title } }) => {
        const date = new Date(title + 'T12:00:00Z');
        const dateText = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', });
        return (<Text style={historyStyles.sectionHeader}>{dateText.charAt(0).toUpperCase() + dateText.slice(1)}</Text>);
    };
    return (
        <View style={historyStyles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f4f6f8" />
            <View style={historyStyles.header}>
                <TouchableOpacity onPress={() => onNavigate('home')} style={historyStyles.backButton}><Text style={historyStyles.backButtonText}>‹</Text></TouchableOpacity>
                <Text style={historyStyles.headerTitle}>Histórico</Text>
                <View style={{ width: 40 }} /> 
            </View>
            <SectionList sections={transactions} keyExtractor={(item) => (item.Id ?? item.id).toString()} renderItem={renderTransactionItem} renderSectionHeader={renderDateHeader} contentContainerStyle={historyStyles.listContent} ListEmptyComponent={<Text style={historyStyles.emptyText}>Nenhuma transação encontrada.</Text>} stickySectionHeadersEnabled={false}/>
        </View>
    );
};


// --- Componente Principal ---
export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeScreen, setActiveScreen] = useState('home');
  const [userToken, setUserToken] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [userProfileData, setUserProfileData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '' });
  const [activeMissions, setActiveMissions] = useState([]);
  const [allMissions, setAllMissions] = useState({ ativas: [], concluidas: [], arquivadas: [] });

  const loadAllData = async (token) => {
    if (!token) return;
    setIsLoading(true);
    setDashboardError(null);
    setTransactions([]);
    try {
        const [dashboard, profile] = await Promise.all([ apiService.getDashboardData(token), apiService.getUserProfile(token) ]);
        setDashboardData(dashboard);
        setUserProfileData(profile);
    } catch (error) { console.error("ERRO CRÍTICO AO CARREGAR DADOS:", error); setDashboardError("Não foi possível carregar os dados principais."); setIsLoading(false); return; }
    try {
        const [ativas, concluidas, falhadas, expiradas] = await Promise.all([
            apiService.getQuestsByStatus(token, 0),
            apiService.getQuestsByStatus(token, 1),
            apiService.getQuestsByStatus(token, 2),
            apiService.getQuestsByStatus(token, 3)
        ]);
        setActiveMissions(ativas);
        setAllMissions({ ativas: ativas, concluidas: concluidas, arquivadas: [...falhadas, ...expiradas].sort((a,b) => new Date(b.dataDeCriacao) - new Date(a.dataDeCriacao)) });
    } catch(error) { 
        console.error("ERRO AO CARREGAR MISSÕES:", error);
        setActiveMissions([]);
        setAllMissions({ ativas: [], concluidas: [], arquivadas: [] });
    }
    try {
        const response = await apiService.getTransactions(token);
        const allTransactions = response.transacoes || response.Transacoes;
        if (Array.isArray(allTransactions)) {
            const groupedByDate = allTransactions.reduce((acc, transaction) => {
                const dateKey = (transaction.Data || transaction.data).split('T')[0];
                if (!acc[dateKey]) { acc[dateKey] = []; }
                acc[dateKey].push(transaction);
                return acc;
            }, {});
            const formattedData = Object.keys(groupedByDate).map(date => ({
                title: date,
                data: groupedByDate[date].sort((a, b) => new Date(b.Data || b.data) - new Date(a.Data || a.data))
            })).sort((a, b) => new Date(b.title) - new Date(a.title));
            setTransactions(formattedData);
        } else {
            console.error("A resposta da API para transações não contém um array válido.");
            setTransactions([]);
        }
    } catch (error) {
        console.error("ERRO (crítico) AO CARREGAR HISTÓRICO:", error);
        setTransactions([]);
        setAlertInfo({ visible: true, title: 'Erro de Histórico', message: `Não foi possível carregar o histórico: ${error.message}` });
    }
    setIsLoading(false);
  };

  useEffect(() => { if (isLoggedIn && userToken) { loadAllData(userToken); } }, [isLoggedIn, userToken]);

  const handleLoginSuccess = (data) => { setUserToken(data.coinUpData.token); setIsLoggedIn(true); setActiveScreen('home'); };
  const handleTransactionSaveSuccess = () => { loadAllData(userToken); handleNavigate('home'); };
  const handleCreateQuestSuccess = async (questData) => { try { await apiService.createQuest(questData, userToken); await loadAllData(userToken); handleNavigate('missions'); } catch (error) { setAlertInfo({ visible: true, title: 'Erro', message: error.message }); }};
  const handleDeleteQuest = async (questId) => { try { await apiService.deleteQuest(questId, userToken); await loadAllData(userToken); } catch (error) { setAlertInfo({ visible: true, title: 'Erro', message: error.message }); }};
  const handleLogout = () => { setUserToken(null); setIsLoggedIn(false); setActiveMissions([]); setAllMissions({ ativas: [], concluidas: [], arquivadas: [] }); setDashboardData(null); setUserProfileData(null); setTransactions([]); setCurrentScreen('login'); };
  const handleNavigate = (screen) => { if (isLoggedIn) { setActiveScreen(screen); } else { setCurrentScreen(screen); } };
  
  const renderScreen = () => {
      if (!isLoggedIn) { return currentScreen === 'login' ? <LoginScreen onNavigate={setCurrentScreen} onLoginSuccess={handleLoginSuccess} /> : <SignUpScreen onNavigate={setCurrentScreen} />; }
      switch (activeScreen) {
        case 'profile': return <ProfileScreen onNavigate={handleNavigate} onLogout={handleLogout} userProfile={userProfileData} isLoading={isLoading} />;
        case 'achievements': return <AchievementsScreen onNavigate={handleNavigate} userProfile={userProfileData} />;
        case 'history': return <TransactionHistoryScreen onNavigate={handleNavigate} transactions={transactions} />;
        case 'addIncome': return <AddIncomeScreen onNavigate={handleNavigate} userToken={userToken} onSaveSuccess={handleTransactionSaveSuccess} dashboardData={dashboardData} />;
        case 'addExpense': return <AddExpenseScreen onNavigate={handleNavigate} userToken={userToken} onSaveSuccess={handleTransactionSaveSuccess} dashboardData={dashboardData} />;
        case 'missions': return <MissionsScreen onNavigate={handleNavigate} missions={allMissions} onDelete={handleDeleteQuest} />;
        case 'createMission': return <CreateMissionScreen onNavigate={handleNavigate} onSave={handleCreateQuestSuccess} />;
        default: return <HomeScreen onNavigate={handleNavigate} missions={activeMissions} dashboardData={dashboardData} isLoading={isLoading} dashboardError={dashboardError} />;
      }
  };

  return ( <View style={styles.container}><AlertModal visible={alertInfo.visible} title={alertInfo.title} message={alertInfo.message} onClose={() => setAlertInfo({ ...alertInfo, visible: false })} />{renderScreen()}</View> );
}

// ==============================================================
// ===== ESTILOS ================================================
// ==============================================================
const historyStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50, paddingBottom: 15, paddingHorizontal: 16, backgroundColor: '#f4f6f8' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#212529' },
    backButton: { position: 'absolute', left: 10, top: Platform.OS === 'android' ? StatusBar.currentHeight + 5 : 45, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
    backButtonText: { fontSize: 32, fontWeight: 'bold', color: '#343a40' },
    listContent: { paddingHorizontal: 16, paddingBottom: 20 },
    sectionHeader: { fontSize: 15, fontWeight: '600', color: '#6c757d', paddingTop: 24, paddingBottom: 8, backgroundColor: '#f4f6f8' },
    card: { backgroundColor: '#ffffff', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, elevation: 1, shadowColor: '#333', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    cardDetails: { flex: 1, marginRight: 10 },
    cardTitle: { fontSize: 16, fontWeight: '500', color: '#212529' },
    cardDescription: { fontSize: 14, color: '#6c757d', marginTop: 3 },
    cardAmount: { fontSize: 16, fontWeight: 'bold' },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#6c757d' }
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  keyboardView: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, paddingVertical: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#333', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 40, textAlign: 'center' },
  inputContainer: { width: '100%', height: 50, backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  inputField: { flex: 1, height: '100%', fontSize: 16, color: '#333' },
  passwordVisibilityButton: { padding: 5 },
  passwordVisibilityText: { color: '#3CB371', fontWeight: 'bold' },
  genderContainer: { width: '100%', flexDirection: 'row', alignItems: 'center', marginBottom: 15, justifyContent: 'center' },
  genderLabel: { fontSize: 16, color: '#666', marginRight: 10 },
  genderButton: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, marginRight: 10, backgroundColor: '#fff' },
  genderButtonSelected: { backgroundColor: '#3CB371', borderColor: '#3CB371' },
  genderButtonText: { fontSize: 14, color: '#333' },
  genderButtonTextSelected: { color: '#fff', fontWeight: 'bold' },
  button: { width: '100%', height: 50, backgroundColor: '#3CB371', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkButton: { marginTop: 25 },
  linkText: { fontSize: 14, color: '#666' },
  linkTextBold: { fontWeight: 'bold', color: '#3CB371' },
  homeContainer: { flex: 1, padding: 20, backgroundColor: '#f8f8f8' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontSize: 20, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row' },
  iconButton: { marginLeft: 10, padding: 5 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e0e0', justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden' },
  iconShape: { backgroundColor: '#aaa' },
  profileHead: { width: 12, height: 12, borderRadius: 6, marginBottom: -2 },
  profileBody: { width: 24, height: 12, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  balanceCard: { backgroundColor: '#3CB371', borderRadius: 16, padding: 25, alignItems: 'center', marginBottom: 20 },
  balanceCardTitle: { color: '#fff', fontSize: 16 },
  balanceCardAmount: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: 5 },
  summaryContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 20, marginHorizontal: 5, borderWidth: 1, borderColor: '#eee' },
  summaryCardTitle: { fontSize: 14, color: '#555', marginBottom: 5 },
  summaryCardAmount: { fontSize: 20, fontWeight: 'bold' },
  missionsCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 16, padding: 20, marginBottom: 20 },
  missionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  missionProgress: { color: '#3CB371', fontWeight: '500' },
  missionProgressContainer: { flexDirection: 'row' },
  backButton: { width: 50 },
  backButtonText: { fontSize: 30, color: '#3CB371' },
  formScrollContainer: { flexGrow: 1, justifyContent: 'space-between', padding: 20 },
  formContainer: { padding: 20 },
  formValueLabel: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 10 },
  formValueInput: { fontSize: 40, fontWeight: 'bold', color: '#3CB371', textAlign: 'center', marginBottom: 30, borderBottomWidth: 2, borderColor: '#eee', paddingBottom: 10 },
  formRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  formLabel: { fontSize: 16, color: '#333', marginRight: 10 },
  formInput: { flex: 1, fontSize: 16, color: '#666', textAlign: 'right' },
  confirmButton: { marginTop: 20, marginBottom: 10 },
  bottomButtonContainer: { padding: 20, borderTopWidth: 1, borderColor: '#eee', backgroundColor: '#f8f8f8', },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalOption: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalOptionText: { fontSize: 16, textAlign: 'center' },
  modalCloseButton: { backgroundColor: '#3CB371', borderRadius: 12, padding: 15, marginTop: 15 },
  modalCloseButtonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 16 },
  alertMessage: { fontSize: 16, color: '#333', textAlign: 'center', marginBottom: 20},
  missionListItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  missionListTitle: { fontSize: 16, fontWeight: '500', marginBottom: 5, },
  missionListValues: { fontSize: 14, color: '#666', marginBottom: 10, },
  progressBarBackground: { height: 8, backgroundColor: '#eee', borderRadius: 4, width: '100%', },
  progressBarFill: { height: 8, backgroundColor: '#3CB371', borderRadius: 4, },
  centeredMessageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8f8f8' },
  errorMessage: { fontSize: 16, color: '#E53E3E', textAlign: 'center' },
  separator: { height: 1, width: '100%', backgroundColor: '#eee', marginVertical: 15, },
  missionsCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',},
  missionsViewMore: { color: '#3CB371', fontWeight: 'bold', fontSize: 14, },
  missionsCardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', },
  missionXpText: { fontSize: 12, color: '#888', },
  deleteButton: { padding: 10, marginLeft: 10, },
  deleteButtonText: { fontSize: 20 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  calendarWeekDay: { width: '14.2%', textAlign: 'center', fontWeight: 'bold', color: '#999', marginBottom: 10 },
  calendarDay: { width: '14.2%', paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  calendarDayText: { fontSize: 16 },
  input: { fontSize: 16, flex: 1, height: '100%' },
  profileContent: { padding: 20, alignItems: 'center', },
  profileHeader: { alignItems: 'center', marginBottom: 30, },
  profileAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#3CB371', justifyContent: 'center', alignItems: 'center', marginBottom: 15, },
  profileAvatarText: { color: '#fff', fontSize: 40, fontWeight: 'bold', },
  profileName: { fontSize: 24, fontWeight: 'bold', color: '#333', },
  profileEmail: { fontSize: 16, color: '#666', marginTop: 5, },
  profileStatsCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', borderWidth: 1, borderColor: '#eee', marginBottom: 20, },
  profileLevelRank: { fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  xpLabel: { fontSize: 14, color: '#666', marginTop: 8, alignSelf: 'center', },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 15, },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', },
  infoLabel: { fontSize: 16, color: '#666' },
  infoValue: { fontSize: 16, color: '#333', fontWeight: '500' },
  secondaryButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#3CB371', },
  secondaryButtonText: { color: '#3CB371' },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', },
  achievementBadge: { width: '45%', backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 15, alignItems: 'center', borderWidth: 1, borderColor: '#eee', },
  lockedBadge: { opacity: 0.4, },
  achievementIcon: { fontSize: 40, },
  achievementName: { fontSize: 16, fontWeight: 'bold', marginTop: 10, },
  pageContainer: { flex: 1, backgroundColor: '#f8f8f8' },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tabContainer: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', paddingVertical: 5, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20 },
  tabActive: { backgroundColor: '#3CB371' },
  tabText: { fontSize: 16, color: '#666', fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },
  emptyMessage: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#6c757d' },
  missionStatusIcon: { fontSize: 24, }
});