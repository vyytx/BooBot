
if(!process.env.hasOwnProperty("PLATFORM") || process.env["PLATFORM"] != "replit")
    require('dotenv').config();

const webServer = require('./webServer.js');

const Discord = require('discord.js');
const Client = new Discord.Client();

const {stripIndents} = require("common-tags");

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const guildDB = low(new FileSync('db/guilds.json'));

// const express = require('express');
// const webApp = express();

const EMOJI = (name) => Client.emojis.cache.find(emoji => emoji.name === name);
// const DELMSG = (msg) => setTimeout(()=>{msg.delete()}, 5000);

const serverSpecific = {
	"829744198529450054" : {
		botCommunicationChannel: () => Client.channels.cache.find(channel => channel.name == "bot-communication"),
		db: guildDB.get('829744198529450054'),
		message: function(msg) {
			// console.log(msg);
			if(msg.hasOwnProperty('author')) {
				// if(msg.channel.parentID == "835298768587980810") {	//for testing
					const {content} = msg;
					const commandChain = content.match(/(?:[^\s"]+|"[^"]*")+/g);
					if(commandChain != null && commandChain[0][0] == '.') {
						// console.log(commandChain[0].slice(1), msg, commandChain.slice(1));
						callCommand(commandChain[0].slice(1), msg, commandChain.slice(1));
					}
				// }
			}else {
				console.error("error 1");
			}
		},
		commands: {
			"For Fun": "sep",
			listAllEmojis: {
				desc: "列出所有自訂emoji",
				usage: ".listAllEmjois",
				func: (msg, ...args) => {
					const emojiList = msg.guild.emojis.cache.map(emoji => emoji.toString()).join(" ");
  					msg.channel.send(emojiList);

				}
			},
			hello: {
				desc: "你好",
				usage:".hello",
				func: function(msg, ...args) {
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
			"Auction": "sep",
			auction: {
				desc: "設立競標間",
				usage: ".auction \"角色名稱\" 拍賣時長(分鐘) 起拍價 [最小叫價漲幅]",
				func: function(msg, ...args) {
					const BRDB = this.db.get('biddingRooms');
					const nowDate = new Date();
					if(args.length <= 2) {
						msg.channel.send(stripIndents`<@${msg.author.id}> 缺少參數，用法請看
							\`\`\`${this["commands"]["auction"]["usage"]}\`\`\`
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
						.then(channel => {
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
							}).write();
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
				desc: "出價",
				usage: ".bid 價格 {在非自己的競標間內}",
				func: function(msg, ...args) {
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
								}).write();
								msg.channel.send(stripIndents`<@${msg.author.id}> 出價：${bid}${EMOJI("Kakera")}`);
								let nowDate = new Date();
								if(auctionObj["endTime"] - nowDate.getTime() <= 5*60*1000) {
									auctionData.assign({
										endTime: nowDate.getTime() + 5*60*1000
									}).write();
									msg.channel.send(stripIndents`由於於末五分鐘內出價，延長時限至 ${new Date(nowDate.getTime() + 5*60*1000)}。`);
								}
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
				desc: "撤銷競標",
				usage: ".revokeAuction {在自己所開設的競標間內，且未開始競標}",
				func: function(msg, ...args) {
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
								setTimeout(() => {
									msg.channel.delete();
									BRDB.remove({channelId: auctionObj["channelId"]})
										.write();
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
			auctionDetail: {
				desc: "列出競標詳細訊息",
				usage: ".auctionDetail {在競標間內}",
				func: function(msg, ...args) {
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
			"Help": "sep",
			help: {
				desc: "幫助",
				usage: ".help [command]",
				func: function(msg, ...args) {
					const embed = new Discord.MessageEmbed()
						.setTitle('Help Command')
						.setDescription('\u200b');
					if(!args.length) {
						let flag = 1;
						Object.keys(this.commands).forEach((key, index) => {
							const x = this.commands[key];
							// console.log(x.desc);
							if(x == "sep") {
								if(key == "TEST") {
									flag = 0;
									return;
								}
								if(index != 0)
									embed.addField(`\u200b`, `\u200b`, false);
								embed.addField(`${key}`, `------------------------`, false);
							}else {
								if(flag)
									embed.addField(`${key} ${x.desc}`, `> ${x.usage}`, false);
							}
						});
					}else {
						if(this.commands.hasOwnProperty(args[0])) {
							const x = this.commands[args[0]];
							embed.addField(`${args[0]} ${x.desc}`, `> ${x.usage}`, false);
						}else {
							msg.reply("沒這指令");
							return;
						}
					}
					msg.channel.send(embed);
				}
			},
			"TEST": "sep",
			testpr: {
				desc: "測試pr",
				usage: ".testpr",
				func: function(msg, ...args) {
					msg.channel.send("$pr");
				}
			}
		},
		checkAuction: function(rawNowDate) {
			let BRDB = this.db.get('biddingRooms');
			BRDB.value().forEach(auctionObj => {
				let channel = Client.channels.cache.find(x => x.id == auctionObj["channelId"]);
				if(rawNowDate.getTime() >= auctionObj["endTime"]) {
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
						.write();
				}
			});
		},
        interval: function(nowDate) {
            this.checkAuction(nowDate);
        },
		invited: function(guildId) {
			guildDB.get(guildId)
				.set("biddingRooms", [])
				.set("users", {})
				.write();
		},
	}
};

let interval = setInterval(() => {
	const nowDate = new Date();
    Client.guilds.cache.forEach(guild => {
		callSpecific('interval', guild.id, [nowDate]);
    });
}, 10000);

Client.on('ready', async (e) => {
	console.log(`Logged in as ${Client.user.tag}!`);
});

const callSpecific = (eventName, serverID, rawArr) => {
	if(serverSpecific.hasOwnProperty(serverID))	// nesting to prevent key not found
		if(serverSpecific[serverID].hasOwnProperty(eventName)) {
			serverSpecific[serverID][eventName].apply(serverSpecific[serverID], rawArr);
			return true;
		}
	return false;
};

const callCommand = (commandName, pureMsg, args) => {
	const serverID = pureMsg.channel.guild.id;
	if(serverSpecific.hasOwnProperty(serverID) && serverSpecific[serverID].hasOwnProperty("commands"))	// nesting to prevent key not found
		if(serverSpecific[serverID]["commands"].hasOwnProperty(commandName)) {
			serverSpecific[serverID]["commands"][commandName]["func"].apply(serverSpecific[serverID], [pureMsg].concat(args));
			return true;
		}
	return false;
}

Client.on('message', (...raw) => {
	const serverID = raw[0].channel.guild.id;	//raw[0] => msg
	const isSpecific = callSpecific('message', serverID, raw);
	if(!isSpecific) {
		// not special
	}
});

Client.on('guildCreate', (guild) => {
	guildDB.set(guild.id, {})
		.write();
	callSpecific('invited', guild.id, [guild.id]);
});

Client.on('guildDelete', (guild) => {
	guildDB.unset(guild.id)
		.write();
});

webServer(); //work as a maintainer
Client.login(process.env["TOKEN"]);