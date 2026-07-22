let feedbackCallback=null;
function openFeedback(type,title,message,buttonLabel,callback){clearTimers();feedbackCallback=typeof callback==='function'?callback:null;const card=$('#feedbackCard');card.classList.remove('correct','wrong');card.classList.add(type);$('#feedbackIcon').textContent=type==='correct'?'✓':'×';$('#feedbackKicker').textContent=type==='correct'?'NICE! JOB FOUND':'SO CLOSE! TRY AGAIN';$('#feedbackTitle').textContent=title;$('#feedbackMessage').textContent=message;$('#feedbackButton').textContent=buttonLabel||'확인 →';openModal('feedbackModal');setTimeout(()=>$('#feedbackButton').focus(),80);}
function confirmFeedback(){const callback=feedbackCallback;feedbackCallback=null;closeModal('feedbackModal');if(callback)callback();}
function finishMatch(winner){clearTimers();state.phase='gameEnd';state.winner=winner;renderGameEnd();save();showScreen('gameEndScreen');}
function finalTeamHtml(side){return `<article class="panel final-team ${side.toLowerCase()}"><div class="final-team-head"><span>${side==='A'?'🔵':'🟠'}</span><div><small>TEAM ${side} JOB CARDS</small><h2>${escapeHtml(teamLabel(side))}</h2></div></div><div class="final-card-grid">${state.rosters[side].map(x=>`<div class="final-card"><small>${escapeHtml(x.player)}</small><strong>${escapeHtml(x.job.name)}</strong><span>${CATEGORIES[x.job.cat].name}</span></div>`).join('')}</div></article>`;}
function renderGameEnd(){const winner=state.winner||'A';$('#gameEndTitle').textContent=`${teamLabel(winner)} 승리!`;$('#gameEndCopy').textContent=`${teamLabel(winner)}이(가) 상대 팀 ${state.teamSizes[opponent(winner)]}명의 직업을 모두 먼저 밝혔습니다.`;$('#finalReveal').innerHTML=finalTeamHtml('A')+finalTeamHtml('B');}
function openModal(id){$('#'+id).classList.remove('hidden');document.body.style.overflow='hidden';}
function closeModal(id){$('#'+id).classList.add('hidden');if(!$$('.modal:not(.hidden)').length)document.body.style.overflow='';}
function resetAll(){clearTimers();if(confirm('현재 팀 배틀을 종료하고 처음 화면으로 돌아갈까요?')){localStorage.removeItem(STORAGE_KEY);location.reload();}}
$('#minusA').addEventListener('click',()=>setTeamSize('A',state.teamSizes.A-1));
$('#plusA').addEventListener('click',()=>setTeamSize('A',state.teamSizes.A+1));
$('#minusB').addEventListener('click',()=>setTeamSize('B',state.teamSizes.B-1));
$('#plusB').addEventListener('click',()=>setTeamSize('B',state.teamSizes.B+1));
$('#startSetup').addEventListener('click',collectSetup);
$('#showTeamA').addEventListener('click',()=>showTeamSecret('A'));
$('#showTeamB').addEventListener('click',()=>showTeamSecret('B'));
$('#beginMatch').addEventListener('click',beginMatch);
$('#dealBack').addEventListener('click',()=>showScreen('setupScreen'));
$('#completeAction').addEventListener('click',resolveAction);
$('#submitGuess').addEventListener('click',submitGuess);
$('#feedbackButton').addEventListener('click',confirmFeedback);
$('#revealBonus').addEventListener('click',revealBonus);
$('#resetBtn').addEventListener('click',resetAll);
$('#newGame').addEventListener('click',()=>{localStorage.removeItem(STORAGE_KEY);location.reload();});
$('#restartSame').addEventListener('click',prepareMatch);
$$('[data-close]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.close;closeModal(id);if(state.phase==='play'&&(id==='actionModal'||id==='guessModal')&&!state.timer)startTurnTimer(false);}));
$$('[data-action]').forEach(button=>button.addEventListener('click',()=>button.dataset.action==='guess'?openGuess():actionPrompt(button.dataset.action)));
$$('[data-bonus-winner]').forEach(button=>button.addEventListener('click',()=>awardBonus(button.dataset.bonusWinner)));
$('#resumeBtn').addEventListener('click',()=>{if(!load())return;$('#teamNameA').value=state.teamNames.A;$('#teamNameB').value=state.teamNames.B;renderTeamInputs('A');renderTeamInputs('B');if(state.phase==='play'){renderPlay();showScreen('playScreen');startTurnTimer(false);}else if(state.phase==='gameEnd'){renderGameEnd();showScreen('gameEndScreen');}else{renderDeal();if(state.revealed.A&&state.revealed.B){$('#beginMatch').disabled=false;$('#beginMatch').textContent='JOB BATTLE 시작 →';}showScreen('dealScreen');}});
window.addEventListener('keydown',event=>{if(event.key==='Enter'&&!$('#feedbackModal').classList.contains('hidden'))confirmFeedback();});
window.addEventListener('beforeunload',save);
initSetup();
