import {expect} from 'chai';
import {ethers, deployments, getUnnamedAccounts, getNamedAccounts} from 'hardhat';
import {AccessRoles, ERC20_PDE, ERC721_Burn, ERC721_KYC} from '../typechain-types';
import {setupUser, setupUsers} from './utils';
import {mine} from '@nomicfoundation/hardhat-network-helpers';

const setup = deployments.createFixture(async () => {
	await deployments.fixture('AccessRoles');
	await deployments.fixture('ERC721_Burn');
	await deployments.fixture('ERC721_KYC');
	await deployments.fixture('ERC20_PDE');
	const {deployer, accountOne, accountTwo, accountThree} = await getNamedAccounts();
	const contracts = {
		AccessRoles: await ethers.getContract<AccessRoles>('AccessRoles'),
		ERC721_Burn: await ethers.getContract<ERC721_Burn>('ERC721_Burn'),
		ERC721_KYC: await ethers.getContract<ERC721_KYC>('ERC721_KYC'),
		ERC20_PDE: await ethers.getContract<ERC20_PDE>('ERC20_PDE'),
	};

	const users = await setupUsers(await getUnnamedAccounts(), contracts);
	return {
		...contracts,
		users,
		deployer: await setupUser(deployer, contracts),
		accountOne: await setupUser(accountOne, contracts),
		accountTwo: await setupUser(accountTwo, contracts),
		accountThree: await setupUser(accountThree, contracts),
	};
});

describe('Overall', function () {
	it('tests head admin & admin privileges', async function () {
		const {ERC20_PDE, deployer, accountOne, accountTwo, accountThree} = await setup();

		await deployer.AccessRoles.grantRole(1, accountTwo.address);
		await deployer.AccessRoles.grantRole(2, accountThree.address);

		await deployer.ERC721_KYC.safeMint(accountOne.address);
		await deployer.ERC721_KYC.safeMint(accountTwo.address);
		await deployer.ERC721_KYC.safeMint(accountThree.address);

		await deployer.ERC20_PDE.mint(deployer.address, ethers.parseEther('1'));
		await deployer.ERC20_PDE.mint(accountOne.address, ethers.parseEther('1'));
		await deployer.ERC20_PDE.mint(accountTwo.address, ethers.parseEther('1'));
		await deployer.ERC20_PDE.mint(accountThree.address, ethers.parseEther('1'));

		await deployer.ERC20_PDE.transfer(accountOne.address, ethers.parseEther('100'));
		await deployer.ERC20_PDE.transfer(accountTwo.address, ethers.parseEther('100'));
		await deployer.ERC20_PDE.transfer(accountThree.address, ethers.parseEther('100'));

		await accountOne.ERC20_PDE.transfer(accountTwo.address, ethers.parseEther('100'));
		await accountTwo.ERC20_PDE.transfer(accountThree.address, ethers.parseEther('100'));
		await accountThree.ERC20_PDE.transfer(deployer.address, ethers.parseEther('100'));

		expect(await ERC20_PDE.balanceOf(deployer.address)).equal(ethers.parseEther('200'));
		expect(await ERC20_PDE.balanceOf(accountOne.address)).equal(ethers.parseEther('1'));
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).equal(ethers.parseEther('101'));
		expect(await ERC20_PDE.balanceOf(accountThree.address)).equal(ethers.parseEther('101'));

		await mine(11, {interval: 86400});

		expect(await ERC20_PDE.balanceOf(deployer.address)).equal(ethers.parseEther('200'));
		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(ethers.parseEther('1') * BigInt(Math.floor(1.05 ** 10 * 1000000000))) / BigInt(1000000000),
			BigInt(1000000000000)
		);
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).to.be.closeTo(
			(ethers.parseEther('101') * BigInt(Math.floor(1.05 ** 10 * 1000000000))) / BigInt(1000000000),
			BigInt(1000000000000)
		);
		expect(await ERC20_PDE.balanceOf(accountThree.address)).equal(ethers.parseEther('101'));

		expect(await ERC20_PDE.getPeriodLengthDays()).equal(30);
		await ERC20_PDE.setPeriodLengthDays(10);
		expect(await ERC20_PDE.getPeriodLengthDays()).equal(10);

		expect(await ERC20_PDE.getNumPeriods()).equal(3);
		await ERC20_PDE.setNumPeriods(10);
		expect(await ERC20_PDE.getNumPeriods()).equal(10);

		expect(await ERC20_PDE.getInterestRate(0)).equal(500);
		expect(await ERC20_PDE.getInterestRate(1)).equal(200);
		expect(await ERC20_PDE.getInterestRate(2)).equal(70);

		await ERC20_PDE.setInterestRateBps(0, 1000);
		await ERC20_PDE.setInterestRateBps(1, 500);
		await ERC20_PDE.setInterestRateBps(2, 250);
		await ERC20_PDE.setInterestRateBps(3, 125);

		expect(await ERC20_PDE.getInterestRate(0)).equal(1000);
		expect(await ERC20_PDE.getInterestRate(1)).equal(500);
		expect(await ERC20_PDE.getInterestRate(2)).equal(250);
		expect(await ERC20_PDE.getInterestRate(3)).equal(125);
		expect(await ERC20_PDE.getInterestRate(4)).equal(0);

		expect(await ERC20_PDE.getBanStatus(accountOne.address)).equal(false);
		await ERC20_PDE.ban(accountOne.address, true);
		await expect(accountOne.ERC20_PDE.transfer(accountTwo.address, ethers.parseEther('1'))).to.be.revertedWith(
			'PDE: transfer from a banned address'
		);
		expect(await ERC20_PDE.getBanStatus(accountOne.address)).equal(true);
	});

	it('tests inflation', async function () {
		const {ERC20_PDE, ERC721_KYC, deployer, accountOne, accountTwo, accountThree} = await setup();

		await deployer.AccessRoles.grantRole(1, accountTwo.address);

		await deployer.ERC721_KYC.safeMint(accountOne.address);
		await deployer.ERC721_KYC.safeMint(accountTwo.address);
		await deployer.ERC721_KYC.safeMint(accountThree.address);

		await deployer.ERC20_PDE.mint(accountOne.address, ethers.parseEther('1000'));
		for (let i = 0; i < 10; ++i) {
			await deployer.ERC20_PDE.mint(accountTwo.address, ethers.parseEther('100'));
		}
		await deployer.ERC20_PDE.mint(accountThree.address, ethers.parseEther('500'));

		await mine(46, {interval: 86400});

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).to.be.closeTo(
			(((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountThree.address)).to.be.closeTo(
			(((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);

		await deployer.ERC20_PDE.mint(accountThree.address, ethers.parseEther('500'));

		await mine(46, {interval: 86400});

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).to.be.closeTo(
			(((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountThree.address)).to.be.closeTo(
			(((((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) +
				(((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000)) *
					BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);
	});

	it('tests inflation balance transfers', async function () {
		const {ERC20_PDE, ERC721_KYC, deployer, accountOne, accountTwo, accountThree} = await setup();

		await deployer.AccessRoles.grantRole(1, accountTwo.address);

		await deployer.ERC721_KYC.safeMint(accountOne.address);
		await deployer.ERC721_KYC.safeMint(accountTwo.address);
		await deployer.ERC721_KYC.safeMint(accountThree.address);

		await deployer.ERC20_PDE.mint(accountOne.address, ethers.parseEther('1000'));
		for (let i = 0; i < 10; ++i) {
			await deployer.ERC20_PDE.mint(accountTwo.address, ethers.parseEther('100'));
		}
		await deployer.ERC20_PDE.mint(accountThree.address, ethers.parseEther('500'));

		await mine(46, {interval: 86400});

		await accountOne.ERC20_PDE.transfer(deployer.address, ethers.parseEther('1100'));
		await accountTwo.ERC20_PDE.transfer(deployer.address, ethers.parseEther('1100'));
		await accountThree.ERC20_PDE.transfer(deployer.address, ethers.parseEther('600'));

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100'),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).to.be.closeTo(
			(((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100'),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountThree.address)).to.be.closeTo(
			(((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('600'),
			BigInt(1_000_000_000_000)
		);

		await deployer.ERC20_PDE.mint(accountThree.address, ethers.parseEther('500'));

		await mine(46, {interval: 86400});

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).to.be.closeTo(
			(((((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountThree.address)).to.be.closeTo(
			(((((((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('600')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) +
				(((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000)) *
					BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);

		await accountOne.ERC20_PDE.transfer(deployer.address, ethers.parseEther('6000'));
		await accountTwo.ERC20_PDE.transfer(deployer.address, ethers.parseEther('6000'));
		await accountThree.ERC20_PDE.transfer(deployer.address, ethers.parseEther('6000'));

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('6000'),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).to.be.closeTo(
			(((((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('6000'),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountThree.address)).to.be.closeTo(
			(((((((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('600')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) +
				(((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000)) *
					BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000) -
				ethers.parseEther('6000'),
			BigInt(1_000_000_000_000)
		);

		await mine(46, {interval: 86400});

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('6000'),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).to.be.closeTo(
			(((((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('6000'),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountThree.address)).to.be.closeTo(
			(((((((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('600')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) +
				(((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000)) *
					BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000) -
				ethers.parseEther('6000'),
			BigInt(1_000_000_000_000)
		);
	});

	it('tests inflation balance burns', async function () {
		const {ERC20_PDE, ERC721_KYC, deployer, accountOne, accountTwo, accountThree} = await setup();

		await deployer.AccessRoles.grantRole(1, accountTwo.address);

		await deployer.ERC721_KYC.safeMint(accountOne.address);
		await deployer.ERC721_KYC.safeMint(accountTwo.address);
		await deployer.ERC721_KYC.safeMint(accountThree.address);

		await deployer.ERC20_PDE.mint(accountOne.address, ethers.parseEther('1000'));
		for (let i = 0; i < 10; ++i) {
			await deployer.ERC20_PDE.mint(accountTwo.address, ethers.parseEther('100'));
		}
		await deployer.ERC20_PDE.mint(accountThree.address, ethers.parseEther('500'));

		await mine(46, {interval: 86400});

		await deployer.ERC20_PDE.burn(accountOne.address, ethers.parseEther('1100'), true);
		await deployer.ERC20_PDE.burn(accountTwo.address, ethers.parseEther('1100'), true);
		await deployer.ERC20_PDE.burn(accountThree.address, ethers.parseEther('600'), true);

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100'),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).to.be.closeTo(
			(((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100'),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountThree.address)).to.be.closeTo(
			(((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('600'),
			BigInt(1_000_000_000_000)
		);

		await deployer.ERC20_PDE.mint(accountThree.address, ethers.parseEther('500'));

		await mine(46, {interval: 86400});

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).to.be.closeTo(
			(((((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountThree.address)).to.be.closeTo(
			(((((((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('600')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) +
				(((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000)) *
					BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);

		await deployer.ERC20_PDE.burn(accountOne.address, ethers.parseEther('6000'), true);
		await deployer.ERC20_PDE.burn(accountTwo.address, ethers.parseEther('6000'), true);
		await deployer.ERC20_PDE.burn(accountThree.address, ethers.parseEther('6000'), true);

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('6000'),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).to.be.closeTo(
			(((((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('6000'),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountThree.address)).to.be.closeTo(
			(((((((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('600')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) +
				(((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000)) *
					BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000) -
				ethers.parseEther('6000'),
			BigInt(1_000_000_000_000)
		);

		await mine(46, {interval: 86400});

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('6000'),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).to.be.closeTo(
			(((((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('1100')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('6000'),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC20_PDE.balanceOf(accountThree.address)).to.be.closeTo(
			(((((((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('600')) *
				BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) +
				(((ethers.parseEther('500') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000)) *
					BigInt(Math.floor(1.02 ** 15 * 1_000_000_000_000_000))) /
					BigInt(1_000_000_000_000_000) -
				ethers.parseEther('6000'),
			BigInt(1_000_000_000_000)
		);
	});
});
