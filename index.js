if(!process.env.hasOwnProperty("PLATFORM") || process.env["PLATFORM"] != "replit")
    require('dotenv').config();

const PREFIX = (process.env["PLATFORM"] == "DEV") ? "_" : ".";

const webServer = require('./webServer.js');

const Discord = require('discord.js');
const Client = new Discord.Client();

const {stripIndents} = require("common-tags");

const _ = require('lodash');

const C2J = require("csvtojson");

(async () => {
	const lowdb = await import('lowdb');
	return {lowdb: lowdb};
})().then(async es6modules => {
	const {Low, JSONFile} = es6modules["lowdb"];

	const guildDB = new Low(new JSONFile('db/guilds.json'));
	await guildDB.read();
	if(!guildDB.data) {
		guildDB.data = {};
		await guildDB.write();
	}
	guildDB.chain = _.chain(guildDB.data);

	const publicDB = new Low(new JSONFile('db/public.json'));
	await publicDB.read();
	if(!publicDB.data) {
		publicDB.data = {
			users: [],
			global: {
				rpg: {
					
				}
			}
		};
		await publicDB.write();
	}
	publicDB.chain = _.chain(publicDB.data);

	const classLinksDB = new Low(new JSONFile('db/classLinks.json'));
	await classLinksDB.read();

	const EMOJI = (name) => Client.emojis.cache.find(emoji => emoji.name === name);

	const serverSpecific = {
		"829744198529450054" : {
			botCommunicationChannel: () => Client.channels.cache.find(channel => channel.name == "bot-communication"),
			db: guildDB.chain.get("829744198529450054"),
			message: function(msg) {
				const {content} = msg;
				if(msg.hasOwnProperty('author')) {
						const commandChain = content.match(/(?:[^\s"]+|"[^"]*")+/g);
						if(commandChain != null && commandChain[0][0] == PREFIX) {
							callCommand(commandChain[0].slice(1), msg, commandChain.slice(1));
						}
				}else {
					console.error("error 1");
				}
			},
			commands: {
				"For Fun": "sep",
				listAllEmojis: {
					_desc: "列出所有自訂emoji",
					_usage: ".listAllEmjois",
					_func: (msg, ...args) => {
						const emojiList = msg.guild.emojis.cache.map(emoji => emoji.toString()).join(" ");
						  msg.channel.send(emojiList);
	
					}
				},
				hello: {
					_desc: "你好",
					_usage:".hello",
					_func: function(msg, ...args) {
						let list = stripIndents`Salut
							Hola
							Привет
							你好
							Ciao
							こんにちは
							Guten Tag
							Olá
							안녕하세요
							أسلام عليكم
							Goddag
							Shikamoo
							Goedendag
							ياسو
							Dzień dobry
							Selamat siang
							नमस्कार
						`.split('\n');
						msg.reply(list[Math.floor(Math.random()*(list.length-1))]);
					}
				},
				"Schedule" : "sep",
				timetable: {
					_desc: "列出課表",
					_usage: ".timetable",
					_func: function(msg, ...args) {
						let text = `__`;
						const tt = this.timetable;
						for(let index = -1; index < tt.length; index++) {
							let timeset = tt[(index == -1) ? 0 : index];
							Object.keys(timeset).forEach((tad, index2) => { // tad == time and days
								if(index == -1)
									text += ((index2 == 0) ? "時間" : `**${tad}**`).padEnd(10, '　') + ((index2 == 5) ? "__" : "");
								else
									text += timeset[tad].padEnd(index2 == 0 ? 10 : 6, '　');
							});
							text += '\n';
						};
						msg.channel.send(text);
					}
				},
				"tt": {
					_type: "alias",
					_orig: "timetable"
				},
				nowClass: {
					_desc: "列出目前的課程資訊",
					_usage: ".nowClass",
					_func: function(msg, ...args) {
						let day = ['','Ｍｏｎ','Ｔｕｅ','Ｗｅｄ','Ｔｈｕ','Ｆｒｉ',''][new Date().getDay()];
						let text = stripIndents`目前是**${this.nowClassName}課**\n${this.nowClass == -1 ? '' : this.timetable[this.nowClass][day]}`;
						let nowClassLink = this.classLinks[this.nowClassName];
						if(nowClassLink != "" && nowClassLink.slice(0,4) == "http")
							text += `\n可以去 ${nowClassLink} 上課`;
						else if(nowClassLink != "")
							text += `\n${nowClassLink}`;
						else
							text += `\n但目前沒有已知的訊息，可能要自己想辦法囉`;
						msg.channel.send(text);
					}
				},
				"nc": {
					_type: "alias",
					_orig: "nowClass"
				},
				"Auction": "sep",
				auction: {
					_desc: "設立競標間",
					_usage: ".auction \"角色名稱\" 拍賣時長(分鐘) 起拍價 [最小叫價漲幅]",
					_func: async function(msg, ...args) {
						const BRDB = this.db.get('biddingRooms');
						const nowDate = new Date();
						if(args.length <= 2) {
							msg.channel.send(stripIndents`<@${msg.author.id}> 缺少參數，用法請看
								\`\`\`${this["commands"]["auction"]["_usage"]}\`\`\`
							`);
							msg.react('❌');
							return;
						}
	
						if(!Number.isInteger(parseFloat(args[1])) || parseFloat(args[1]) <= 0) {
							msg.channel.send(stripIndents`<@${msg.author.id}> 惡徒，請填一個正整數的時間`);
							msg.react('❌');
							return;
						}
	
						let minRaise = 1;
						const characterName = args[0].replace(/^"(.*)"$/, '$1').toLowerCase();
	
						if(args.length == 4) { // minBidRaise
							minRaise = 	args[3];
							let isRate = false;
							if(minRaise.slice(-1) == '%') {
								isRate = true;
								minRaise = minRaise.slice(0, -1);
							}
							if(isNaN(minRaise) || !Number.isInteger(parseFloat(minRaise)) || parseFloat(minRaise) <= 0) {
								msg.channel.send(stripIndents`<@${msg.author.id}> 「最小叫價漲幅」應為合法的正整數或正百分比`);
								msg.react('❌');
								return;
							}
							if(isRate)
								minRaise = Math.floor(minRaise * args[2] / 100);
						}
	
						if(BRDB.find({productName: characterName}).value()) {
							msg.channel.send(stripIndents`<@${msg.author.id}> 這個競標間已經存在了`);
							msg.react('❌');
							return;
						}
	
						if(!Number.isInteger(parseFloat(args[2])) || parseFloat(args[1]) <= 0) {
							msg.channel.send(stripIndents`<@${msg.author.id}> 惡徒，請填一個正整數的價格`);
							msg.react('❌');
							return;
						}
	
						msg.react('✅');
	
						let onlyForPermission = (c) => c.updateOverwrite(c.guild.roles["everyone"], { MANAGE_CHANNELS: false });
	
						msg.channel.guild.channels.create(`競標間 ${characterName}`)
							.then(async channel => {
								let category = msg.channel.guild.channels.cache.find(c => c.name == "特種貿易區" && c.type == "category");
								if (!category) throw new Error("Category channel does not exist");
								// console.log('nowAuctioned.'+characterName);
								BRDB.push({
									productName: characterName,
									owner: msg.author.id,
									endTime: nowDate.getTime() + parseFloat(args[1])*60*1000,
									lastBidder: msg.author.id,
									lastBid: Number(parseInt(args[2]) - minRaise),
									minRaise: Number(minRaise),
									channelId: channel.id
								}).value();
								await guildDB.write();
								setTimeout(() => onlyForPermission(channel), 300);
								channel.setParent(category.id);
								channel.send(stripIndents`
									<@${msg.author.id}> 發起了對 「${characterName}」的競標，
									末五分鐘若出價則延長時限至該出價時間後五分鐘
									起拍價：　　　　${parseInt(args[2])}${EMOJI("Kakera")}
									最小叫價漲幅：　${minRaise}${EMOJI("Kakera")}
									時限：　　　　　${new Date(BRDB.find({channelId: channel.id}).value()["endTime"])}
								`);
							}).catch(console.error);
						return;
					}
				},
				bid: {
					_desc: "出價",
					_usage: ".bid 價格 {在非自己的競標間內}",
					_func: async function(msg, ...args) {
						const BRDB = this.db.get('biddingRooms');
						const auctionData = BRDB.find({channelId: msg.channel.id});
						const auctionObj = auctionData.value();
						if(auctionObj) {
							if(msg.author.id == auctionObj["owner"]) {
								msg.channel.send(stripIndents`<@${auctionObj["owner"]}> 還想自己抬價阿！`);
								msg.react('❌');
								return;
							}else {
								const bid = args[0]/1;
								if(!Number.isInteger(bid) || bid <= 0) {
									msg.channel.send(stripIndents`<@${msg.author.id}> 惡徒，請開一個正整數的價格！`);
									msg.react('❌');
									return;
								}
								// console.log("lastBid", typeof auctionObj["lastBid"], "minRaise", typeof auctionObj["minRaise"]);
								if(bid >= auctionObj["lastBid"] + auctionObj["minRaise"]) {
									msg.react('✅');
									auctionData.assign({
										lastBidder: msg.author.id,
										lastBid: bid
									}).value();
									msg.channel.send(stripIndents`<@${msg.author.id}> 出價：${bid}${EMOJI("Kakera")}`);
									let nowDate = new Date();
									if(auctionObj["endTime"] - nowDate.getTime() <= 5*60*1000) {
										auctionData.assign({
											endTime: nowDate.getTime() + 5*60*1000
										}).value();
										msg.channel.send(stripIndents`由於於末五分鐘內出價，延長時限至 ${new Date(nowDate.getTime() + 5*60*1000)}。`);
									}
									await guildDB.write();
									return;
								}else {
									// console.log(bid,  auctionObj["lastBid"]/1 + auctionObj["minRaise"]/1, bid >= auctionObj["lastBid"]/1 + auctionObj["minRaise"]/1);
									msg.channel.send(stripIndents`<@${msg.author.id}> 未過出價最低漲幅。`);
									msg.react('❌');
									return;
								}
							}
						}
						msg.channel.send(stripIndents`<@${msg.author.id}>，這裡不是個出價的地方！`);
						msg.react('❌');
						return;
					}
				},
				revokeAuction: {
					_desc: "撤銷競標",
					_usage: ".revokeAuction {在自己所開設的競標間內，且未開始競標}",
					_func: function(msg, ...args) {
						const BRDB = this.db.get('biddingRooms');
						const auctionData = BRDB.find({channelId: msg.channel.id});
						const auctionObj = auctionData.value();
						if(auctionObj) {
							if(msg.author.id == auctionObj["owner"]) {
								if(auctionObj["owner"] == auctionObj["lastBidder"]) {
									msg.channel.updateOverwrite(msg.channel.guild.roles["everyone"], { VIEW_CHANNEL: false });
									msg.channel.updateOverwrite(msg.channel.guild.members.cache.find(x => x.id == auctionObj["owner"]), { VIEW_CHANNEL: true });
									msg.react('✅');
									msg.channel.send(stripIndents`<@${auctionObj["owner"]}>，已撤銷，將在三秒後關閉競標間！`);
									setTimeout(async () => {
										msg.channel.delete();
										BRDB.remove({channelId: auctionObj["channelId"]})
											.value();
										await guildDB.write();
									}, 3000);
									return;
								}else {
									msg.channel.send(stripIndents`<@${auctionObj["owner"]}>，已經有人叫價了，原則上不可以提早徹銷。
										若仍有需要請聯絡<@317866573517946881>。
									`);
									msg.react('❌');
									return;
								}
							}else {
								msg.channel.send(stripIndents`<@${auctionObj["owner"]}>，這個競標間不是你的！`);
								msg.react('❌');
								return;
							}
						}
						msg.channel.send(stripIndents`<@${msg.author.id}>，這裡看起來不是個競標間`);
						msg.react('❌');
						return;
					}
				},
				"ra": {
					_type: "alias",
					_orig: "revokeAuction"
				},
				auctionDetail: {
					_desc: "列出競標詳細訊息",
					_usage: ".auctionDetail {在競標間內}",
					_func: function(msg, ...args) {
						const BRDB = this.db.get('biddingRooms');
						const auctionData = BRDB.find({channelId: msg.channel.id});
						const auctionObj = auctionData.value();
						if(auctionObj) {
							msg.channel.send(stripIndents`品項：**${auctionObj["productName"]}**
								${(auctionObj["lastBidder"] == auctionObj["owner"]) 
									? `目前未有人喊價，起標價：${auctionObj["lastBid"] + auctionObj["minRaise"]}${EMOJI('Kakera')}`
									: `目前最高價：${auctionObj["lastBid"]}${EMOJI('Kakera')}(由<@${auctionObj["lastBidder"]}>)`
								}
								最小叫價漲幅：${auctionObj["minRaise"]}${EMOJI('Kakera')}
								於 ${new Date(auctionObj["endTime"])} 截止
							`);
							return;
						}
						msg.channel.send(stripIndents`<@${msg.author.id}>，這裡看起來不是個競標間`);
						msg.react('❌');
						return;
					}
				},
				"ad": {
					_type: "alias",
					_orig: "auctionDetail"
				},
				"Help": "sep",
				help: {
					_desc: "幫助",
					_usage: ".help [command]",
					_func: function(msg, ...args) {
						const embed = new Discord.MessageEmbed()
							.setTitle('Help Command')
							.setDescription('\u200b');
						if(!args.length) {
							let flag = 1;
							Object.keys(this.commands).forEach((key, index) => {
								const x = this.commands[key];
								if(x == "sep") {
									if(key == "TEST") {
										flag = 0;
										return;
									}
									if(index != 0)
										embed.addField(`\u200b`, `\u200b`, false);
									embed.addField(`${key}`, `------------------------`, false);
								}else {
									if(flag) {
										if(x.hasOwnProperty("_type") && x["_type"] == "alias") {
											embed.fields.find(f => f.name == `${x["_orig"]} ${this.commands[x["_orig"]]["_desc"]}`).name += ` ⇔ ${key}`;
											return;
										}
										embed.addField(`${key} ${x['_desc']}`, `> ${x['_usage']}`, false);
									}
								}
							});
						}else {
							if(this.commands.hasOwnProperty(args[0])) {
								const x = this.commands[args[0]];
								embed.addField(`${args[0]} ${x['_desc']}`, `> ${x['_usage']}`, false);
							}else {
								msg.reply("沒這指令");
								return;
							}
						}
						msg.channel.send(embed);
					}
				},
				"TEST": "sep",
			},
			timetable: await C2J().fromFile("db/timetable.csv"),
			classLinks: classLinksDB.data,
			nowClass: -1,
			nowClassName: "下",
			checkAuction: async function(rawNowDateObj) {
				const BRDB = this.db.get('biddingRooms');
				BRDB.value().forEach(async auctionObj => {
					let channel = Client.channels.cache.find(x => x.id == auctionObj["channelId"]);
					if(rawNowDateObj.getTime() >= auctionObj["endTime"]) {
						channel.updateOverwrite(channel.guild.roles["everyone"], { VIEW_CHANNEL: false });
						channel.updateOverwrite(channel.guild.members.cache.find(x => x.id == auctionObj["owner"]), { VIEW_CHANNEL: true });
						if(auctionObj["lastBidder"] != auctionObj["owner"]) {	// has been bidded
							channel.updateOverwrite(channel.guild.members.cache.find(x => x.id == auctionObj["lastBidder"]), { VIEW_CHANNEL: true });
							channel.send(stripIndents`－－－－結標－－－－
								${auctionObj["productName"]} 已由 <@${auctionObj["lastBidder"]}> 以 ${auctionObj["lastBid"]}${EMOJI("Kakera")} 得標
								已鎖定除得標者與標的物所有者以外之頻道可視權限
								請 <@${auctionObj["owner"]}> 盡快與 <@${auctionObj["lastBidder"]}> 交易
							`);
						}else {		// hasn't been bidded
							// console.log(channel);
							channel.send(stripIndents`－－－－流標－－－－
								已鎖定除標的物所有者以外之頻道可視權限
								<@${auctionObj["lastBidder"]}>，「${auctionObj["productName"]}」的起標價也許設的太高囉
							`);
						}
						BRDB.remove({channelId: auctionObj["channelId"]})
							.value();
						await guildDB.write();
					}
				});
			},
			sendClassAnnounce: function(nowDateObj) {
				let channel = Client.channels.cache.find(x => x.id == 852371193092898826);
				let day = ['','Ｍｏｎ','Ｔｕｅ','Ｗｅｄ','Ｔｈｕ','Ｆｒｉ',''][nowDateObj.getDay()];
				if(day != '')
					this.timetable.forEach((timeset, index) => {
						let time = timeset['ｔｉｍｅ'].split('').map(x => {
							let c = x.charCodeAt(0);
							if(c >= 0xFF00 && c <= 0xFFEF)
								c = 0xFF & (c + 0x20);
							return String.fromCharCode(c);
						}).join('');
						let timesetHourStart = parseInt(time.slice(0,2));
						let timesetMinuteStart = parseInt(time.slice(2,4));
						let timesetHourStop = parseInt(time.slice(5,7));
						let timesetMinuteStop = parseInt(time.slice(7,9));

						let offsetPanning = 8 + (360+nowDateObj.getTimezoneOffset())/15;
						let h = (nowDateObj.getHours() + offsetPanning)%24, m = nowDateObj.getMinutes();

						if(h == timesetHourStop && m == timesetMinuteStop) {
							if(this.nowClass != -1) {
								this.nowClass = -1;
								channel.send(`理論上現在下課囉`);
								this.nowClassName = "下";
							}
						}else if(h == timesetHourStart && m == timesetMinuteStart) {
							if(this.nowClass != index) {
								this.nowClass = index;
								this.nowClassName = timeset[day];
								if(this.nowClassName != "－－") {
									let nowClassLink = this.classLinks[this.nowClassName];
									let textBefore = `@everyone，在正常情況下現在是**${this.nowClassName}課**的時間`;
									if(nowClassLink != "" && nowClassLink.slice(0,4) == "http")
										channel.send(stripIndents`${textBefore}
											可以去 ${nowClassLink} 上課
										`);
									else if(nowClassLink != "")
										channel.send(`${textBefore}\n${nowClassLink}`);
									else
										channel.send(`${textBefore}\n但目前沒有已知的訊息，可能要自己想辦法囉`);
								}
							}
						}
					});
			},
			interval: function(nowDateObj) {
				this.checkAuction(nowDateObj);
				this.sendClassAnnounce(nowDateObj);
			},
			invited: async function(guildId) {
				guildDB.chain
					.set(guildId, {
						biddingRooms: [],
						users: []
					})
					.value();
				await guildDB.write();
			},
		},
		"dm": {
			message: function(msg) {
				const {content} = msg;
				if(msg.hasOwnProperty('author')) {
					const commandChain = content.match(/(?:[^\s"]+|"[^"]*")+/g);
					if(commandChain != null && commandChain[0][0] == '.') {
						callCommand(commandChain[0].slice(1), msg, commandChain.slice(1));
					}
				}else {
					console.error("error 1");
				}
			},
			commands: {
				"RPG Private": "sep",
				createCharacter: {
					_desc: "創建角色",
					_usage: ".createCharacter 角色id {角色id中不允許大部分特殊字元及空格，至多20字元，且第一字元不得為半形數字}",
					_func: function(msg, ...args) {
						const USSDB = publicDB.get("users");
						const user = msg.author.id;
						if(args.length < 1) {
							msg.channel.send(stripIndents`<@${msg.author.id}> 缺少參數，用法請看
								\`\`\`${this["commands"]["createCharacter"]["usage"]}\`\`\`
							`);
							msg.react('❌');
							return;
						}
						if(!USSDB.find({id: user}).value()) {
							msg.channel.send(stripIndents`<@${msg.author.id}> 由於您是第一次使用BooBot Account
								將為您建立資料集
							`);
							USSDB.push({
								id: user,
								rpg: {
									createdCharacters: 0,
									characters: []
								}
							}).write();
						}
						const USDB = USSDB.find({id: user});
						if(USDB.get("rpg.characters").size().value() == 3) {
							msg.channel.send(stripIndents`<@${msg.author.id}>，最多只能創建三隻角色`);
							msg.react('❌');
							return;
						}
						USDB.get("rpg.characters").push({
							id: user
						})
						// msg.channel.send(stripIndents`<@${msg.author.id}> 由於您是第一次使用BooBot Account
						// 	將為您建立資料集
						// `);
						// msg.react('❌');
						return;
					}
				},
			},
		}
	};
	
	let interval = setInterval(() => {
		const nowDate = new Date();
		Client.guilds.cache.forEach(guild => {
			callSpecific('interval', guild.id, [nowDate]);
		});
	}, 10000);

	const callSpecific = (eventName, serverID, rawArr) => {
		if(serverSpecific.hasOwnProperty(serverID))	// nesting to prevent key not found
			if(serverSpecific[serverID].hasOwnProperty(eventName)) {
				serverSpecific[serverID][eventName].apply(serverSpecific[serverID], rawArr);
				return true;
			}
		return false;
	};
	
	const callCommand = (commandName, pureMsg, args) => {
		let serverID;
		if(pureMsg.channel.type == 'dm')
			serverID = 'dm';
		else
			serverID = pureMsg.channel.guild.id;
		if(serverSpecific.hasOwnProperty(serverID) && serverSpecific[serverID].hasOwnProperty("commands"))	// nesting to prevent key not found
			if(serverSpecific[serverID]["commands"].hasOwnProperty(commandName)) {
				if(serverSpecific[serverID]["commands"][commandName].hasOwnProperty("_type") && serverSpecific[serverID]["commands"][commandName]["_type"] == "alias") {
					realCommandName = serverSpecific[serverID]["commands"][commandName]["_orig"];
					serverSpecific[serverID]["commands"][realCommandName]["_func"].apply(serverSpecific[serverID], [pureMsg].concat(args));
				}else {
					serverSpecific[serverID]["commands"][commandName]["_func"].apply(serverSpecific[serverID], [pureMsg].concat(args));
				}
				return true;
			}
		return false;
	}

	global["saveDB"] = () => {
		publicDB.write();
		guildDB.write();
	}

	Client.on('ready', async (e) => {
		console.log(`Logged in as ${Client.user.tag}!`);
	});
	
	Client.on('message', (...raw) => {
		if(raw[0].channel.type === 'dm') {
			const isSpecific = callSpecific('message', 'dm', raw);
			if(!isSpecific) {
				// not special
			}
		}else {
			const serverID = raw[0].channel.guild.id;	//raw[0] => msg
			const isSpecific = callSpecific('message', serverID, raw);
			if(!isSpecific) {
				// not special
			}
		}
	});

	Client.on('guildCreate', (guild) => {
		guildDB.chain.set(guild.id, {})
			.value();
		callSpecific('invited', guild.id, [guild.id]);
	});
	
	Client.on('guildDelete', async (guild) => {
		guildDB.chain.unset(guild.id)
			.value();
		await guildDB.write();
	});
	
	webServer(); //work as a maintainer
	Client.login(process.env["TOKEN"]);
});

// const urgentSave = () => {
// 	if(global.hasOwnProperty('saveDB'))
// 		global['saveDB']();
// 	else
// 		console.log("can't save.");
// }

// process.on('uncaughtException', urgentSave);

// process.on('exit', urgentSave);

// process.on('SIGINT', urgentSave);