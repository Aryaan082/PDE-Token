import {expect} from 'chai';
import {ethers, deployments, getUnnamedAccounts, getNamedAccounts} from 'hardhat';
import {AccessRoles, ERC20_PDE, ERC721_Burn, ERC721_KYC} from '../typechain-types';
import {setupUser, setupUsers} from './utils';
import {mine} from '@nomicfoundation/hardhat-network-helpers';

const setup = deployments.createFixture(async () => {
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

describe('ERC20_PDE', function () {
	it('tests deployment', async function () {
		const {ERC20_PDE} = await setup();

		expect(await ERC20_PDE.name()).equal('PDE_Token');
		expect(await ERC20_PDE.symbol()).equal('PDE');
	});

	it('tests interestRate', async function () {
		const {ERC20_PDE, deployer} = await setup();

		expect(await ERC20_PDE.interestRateOneBps()).equal(500);
		expect(await ERC20_PDE.interestRateTwoBps()).equal(200);
		expect(await ERC20_PDE.interestRateThreeBps()).equal(70);

		await deployer.ERC20_PDE.setInterestRateOneBps(1000);
		await deployer.ERC20_PDE.setInterestRateTwoBps(500);
		await deployer.ERC20_PDE.setInterestRateThreeBps(250);

		expect(await ERC20_PDE.interestRateOneBps()).equal(1000);
		expect(await ERC20_PDE.interestRateTwoBps()).equal(500);
		expect(await ERC20_PDE.interestRateThreeBps()).equal(250);
	});

	it('tests mint & balanceOf without interest', async function () {
		const {ERC20_PDE, deployer, accountOne} = await setup();

		await deployer.ERC20_PDE.mint(accountOne.address, ethers.parseEther('1000'));

		expect(await ERC20_PDE.balanceOf(accountOne.address)).equal(ethers.parseEther('1000'));

		await mine(11, {interval: 86400});

		expect(await ERC20_PDE.balanceOf(accountOne.address)).equal(ethers.parseEther('1000'));
	});

	it('tests mint & balanceOf with interest', async function () {
		const {ERC20_PDE, ERC721_KYC, deployer, accountOne} = await setup();

		await deployer.ERC721_KYC.safeMint(accountOne.address);
		await deployer.ERC20_PDE.mint(accountOne.address, ethers.parseEther('1000'));

		expect(await ERC721_KYC.balanceOf(accountOne.address)).equal(1);
		expect(await ERC20_PDE.balanceOf(accountOne.address)).equal(ethers.parseEther('1000'));

		await mine(11, {interval: 86400});

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 10 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);

		await mine(81, {interval: 86400});

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);

		await mine(91, {interval: 86400});

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.02 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000)) *
				BigInt(Math.floor(1.007 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000),
			BigInt(1_000_000_000_000)
		);
	});

	it('tests transferFrom & transfer without interest', async function () {
		const {ERC20_PDE, deployer, accountOne, accountTwo} = await setup();

		await deployer.ERC20_PDE.transferFrom(deployer.address, accountOne.address, ethers.parseEther('10'));
		await deployer.ERC20_PDE.mint(accountOne.address, ethers.parseEther('1000'));

		expect(await ERC20_PDE.balanceOf(deployer.address)).equal(ethers.parseEther('50000'));
		expect(await ERC20_PDE.balanceOf(accountOne.address)).equal(ethers.parseEther('1010'));

		await expect(
			deployer.ERC20_PDE.transferFrom(accountTwo.address, accountOne.address, ethers.parseEther('1'))
		).to.be.revertedWith('PDE: Transfer amount exceeds balance with interest');
		await deployer.ERC20_PDE.transferFrom(accountOne.address, accountTwo.address, ethers.parseEther('10'));

		expect(await ERC20_PDE.balanceOf(accountOne.address)).equal(ethers.parseEther('1000'));
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).equal(ethers.parseEther('10'));

		await accountOne.ERC20_PDE.transferFrom(accountOne.address, accountTwo.address, ethers.parseEther('10'));
		await accountOne.ERC20_PDE.transfer(accountTwo.address, ethers.parseEther('10'));

		expect(await ERC20_PDE.balanceOf(accountOne.address)).equal(ethers.parseEther('980'));
		expect(await ERC20_PDE.balanceOf(accountTwo.address)).equal(ethers.parseEther('30'));
	});

	it('tests transferFrom & transfer with interest', async function () {
		const {ERC20_PDE, deployer, accountOne, accountTwo} = await setup();

		await deployer.ERC721_KYC.safeMint(accountOne.address);
		await deployer.ERC20_PDE.mint(accountOne.address, ethers.parseEther('1000'));

		await mine(31, {interval: 86400});

		await deployer.ERC20_PDE.transferFrom(accountOne.address, accountTwo.address, ethers.parseEther('10'));

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000))) /
				BigInt(1_000_000_000_000) -
				ethers.parseEther('10'),
			BigInt(1_000_000_000_000)
		);

		await mine(31, {interval: 86400});

		await accountOne.ERC20_PDE.transfer(accountTwo.address, ethers.parseEther('10'));

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('10')) *
				BigInt(Math.floor(1.02 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('10'),
			BigInt(1_000_000_000_000)
		);
	});

	it('tests burn without interest', async function () {
		const {ERC20_PDE, ERC721_Burn, deployer, accountOne, accountTwo} = await setup();

		await deployer.ERC20_PDE.mint(accountOne.address, ethers.parseEther('1000'));
		await deployer.ERC20_PDE.mint(deployer.address, ethers.parseEther('1000'));
		await expect(accountOne.ERC20_PDE.burn(accountOne.address, ethers.parseEther('10'), false)).to.be.revertedWith(
			'ERC20: required role not granted'
		);

		await deployer.ERC20_PDE.burn(accountOne.address, ethers.parseEther('100'), false);
		await deployer.ERC20_PDE.burn(deployer.address, ethers.parseEther('100'), false);

		expect(await ERC20_PDE.balanceOf(deployer.address)).equal(ethers.parseEther('900'));
		expect(await ERC20_PDE.balanceOf(accountOne.address)).equal(ethers.parseEther('900'));
		expect(await ERC721_Burn.balanceOf(deployer.address)).equal(0);
		expect(await ERC721_Burn.balanceOf(accountOne.address)).equal(0);

		await deployer.ERC20_PDE.burn(accountOne.address, ethers.parseEther('100'), true);

		expect(await ERC20_PDE.balanceOf(accountOne.address)).equal(ethers.parseEther('800'));
		expect(await ERC721_Burn.balanceOf(accountOne.address)).equal(1);
		expect(await ERC721_Burn.getTokensBurned(0)).equal(ethers.parseEther('100'));

		await expect(deployer.ERC20_PDE.burn(accountOne.address, ethers.parseEther('900'), true)).to.be.revertedWith(
			'ERC20: burn amount exceeds balance'
		);

		expect(await ERC721_Burn.balanceOf(accountOne.address)).equal(1);
	});

	it('tests burn with interest', async function () {
		const {ERC20_PDE, ERC721_Burn, deployer, accountOne} = await setup();

		await deployer.ERC721_KYC.safeMint(accountOne.address);
		await deployer.ERC20_PDE.mint(accountOne.address, ethers.parseEther('1000'));
		await deployer.ERC20_PDE.mint(deployer.address, ethers.parseEther('1000'));
		await expect(accountOne.ERC20_PDE.burn(accountOne.address, ethers.parseEther('10'), false)).to.be.revertedWith(
			'ERC20: required role not granted'
		);

		await mine(31, {interval: 86400});

		await expect(accountOne.ERC20_PDE.burn(accountOne.address, ethers.parseEther('10'), true)).to.be.revertedWith(
			'ERC20: required role not granted'
		);
		await deployer.ERC20_PDE.burn(accountOne.address, ethers.parseEther('10'), true);

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000))) /
				BigInt(1_000_000_000_000) -
				ethers.parseEther('10'),
			BigInt(1_000_000_000_000)
		);

		await mine(31, {interval: 86400});

		await deployer.ERC20_PDE.burn(accountOne.address, ethers.parseEther('100'), false);
		await deployer.ERC20_PDE.burn(accountOne.address, ethers.parseEther('200'), true);

		expect(await ERC20_PDE.balanceOf(accountOne.address)).to.be.closeTo(
			(((ethers.parseEther('1000') * BigInt(Math.floor(1.05 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('10')) *
				BigInt(Math.floor(1.02 ** 30 * 1_000_000_000_000_000))) /
				BigInt(1_000_000_000_000_000) -
				ethers.parseEther('100') -
				ethers.parseEther('200'),
			BigInt(1_000_000_000_000)
		);
		expect(await ERC721_Burn.balanceOf(accountOne.address)).equal(2);
		expect(await ERC721_Burn.getTokensBurned(0)).equal(ethers.parseEther('10'));
		expect(await ERC721_Burn.getTokensBurned(1)).equal(ethers.parseEther('200'));
	});

	it('tests accessRoles', async function () {
		const {accountOne} = await setup();

		await expect(accountOne.ERC20_PDE.mint(accountOne.address, ethers.parseEther('1000'))).to.be.revertedWith(
			'ERC20: required role not granted'
		);
	});
});
