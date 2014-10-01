<?php
namespace Szurubooru\Tests\SearchService;

use \Szurubooru\Tests\AbstractTestCase;
use \Szurubooru\Helpers\InputReader;
use \Szurubooru\SearchServices\Filters\UserFilter;
use \Szurubooru\SearchServices\Parsers\UserSearchParser;

class UserSearchParserTest extends AbstractTestCase
{
	private $inputReader;
	private $userSearchParser;

	public function setUp()
	{
		parent::setUp();
		$this->inputReader = new InputReader;
		$this->userSearchParser = new UserSearchParser();
	}

	public function testDefaultOrder()
	{
		$filter = $this->userSearchParser->createFilterFromInputReader($this->inputReader);
		$this->assertEquals([UserFilter::ORDER_NAME => UserFilter::ORDER_ASC], $filter->getOrder());
	}

	public function testInvalidOrder()
	{
		$this->inputReader->order = 'invalid,desc';
		$this->setExpectedException(\Exception::class);
		$filter = $this->userSearchParser->createFilterFromInputReader($this->inputReader);
	}

	public function testInvalidOrderDirection()
	{
		$this->inputReader->order = 'name,invalid';
		$this->setExpectedException(\Exception::class);
		$filter = $this->userSearchParser->createFilterFromInputReader($this->inputReader);
	}

	public function testParamOrder()
	{
		$this->inputReader->order = 'name,desc';
		$filter = $this->userSearchParser->createFilterFromInputReader($this->inputReader);
		$this->assertEquals([UserFilter::ORDER_NAME => UserFilter::ORDER_DESC], $filter->getOrder());
	}

	public function testTokenOrder()
	{
		$this->inputReader->query = 'order:name,desc';
		$filter = $this->userSearchParser->createFilterFromInputReader($this->inputReader);
		$this->assertEquals([UserFilter::ORDER_NAME => UserFilter::ORDER_DESC], $filter->getOrder());
	}

	public function testParamAndTokenOrder()
	{
		$this->inputReader->order = 'registration_time,desc';
		$this->inputReader->query = 'order:name,desc';
		$filter = $this->userSearchParser->createFilterFromInputReader($this->inputReader);
		$this->assertEquals([
			UserFilter::ORDER_REGISTRATION_TIME => UserFilter::ORDER_DESC,
			UserFilter::ORDER_NAME => UserFilter::ORDER_DESC],
			$filter->getOrder());
	}
}